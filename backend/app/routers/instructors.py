from typing import List, Optional

from app.auth import decode_token, get_current_user, hash_password, oauth2_scheme, require_manager
from app.database import get_db
from app.limiter import get_jwt_sub, limiter
from app.models.instructor import Instructor
from app.models.user import User
from app.schemas.instructor import InstructorCreate, InstructorResponse, InstructorUpdate
from app.services.photo_service import delete_old_photo, validate_and_save_photo
from app.utils import raise_api_error
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/instructors", tags=["instructors"])


def _build_instructor_response(instructor: Instructor, user: User) -> dict:
    return {
        "id": instructor.id,
        "user_id": instructor.user_id,
        "bio": instructor.bio,
        "full_name": user.full_name,
        "email": user.email,
        "is_active": user.is_active,
        "photo_url": f"/api/v1/photos/{instructor.photo_path}" if instructor.photo_path else None,
        "created_at": instructor.created_at,
        "updated_at": instructor.updated_at,
    }


def _authorize_instructor_photo_upload(
    instructor_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Instructor:
    """A manager may upload on behalf of any instructor. An instructor may only
    upload their own photo — resolved via Instructor.user_id, never by trusting
    the path's instructor_id against the token's sub directly (role/entity
    confusion risk per SECURITY_GUIDELINES.md §1.1).
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    role = payload.get("role", "client")
    if role not in ("manager", "instructor"):
        raise_api_error("AUTH_INSUFFICIENT_PERMISSIONS", "Staff access required", status_code=403)

    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise_api_error("NOT_FOUND", "Instructor not found", status_code=404)

    if role == "instructor":
        sub = payload.get("sub")
        if sub is None or instructor.user_id != int(sub):
            raise_api_error(
                "AUTH_INSUFFICIENT_PERMISSIONS",
                "You may only upload your own photo.",
                status_code=403,
            )

    return instructor


@router.get("", response_model=List[InstructorResponse])
def list_instructors(
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Instructor)
    if search:
        if search.isdigit():
            query = query.filter(Instructor.id == int(search))
        else:
            pattern = f"%{search}%"
            query = query.join(User, Instructor.user_id == User.id).filter(
                (User.full_name.ilike(pattern)) | (User.email.ilike(pattern))
            )
    instructors = query.all()
    result = []
    for inst in instructors:
        user = db.query(User).filter(User.id == inst.user_id).first()
        if user and (user.is_active or include_inactive):
            result.append(_build_instructor_response(inst, user))
    return result


@router.patch("/{instructor_id}/reactivate", response_model=InstructorResponse)
def reactivate_instructor(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Instructor not found"}},
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()
    user.is_active = True
    db.commit()
    db.refresh(instructor)
    db.refresh(user)
    return _build_instructor_response(instructor, user)


@router.post("", response_model=InstructorResponse, status_code=status.HTTP_201_CREATED)
def create_instructor(
    payload: InstructorCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    # Check email not already in use
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "AUTH_EMAIL_EXISTS", "message": "Email already in use"}},
        )

    # Create User with instructor role
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="instructor",
        is_active=True,
    )
    db.add(user)
    db.flush()  # get user.id without committing

    # Create Instructor record
    instructor = Instructor(
        user_id=user.id,
        bio=payload.bio,
    )
    db.add(instructor)
    db.commit()
    db.refresh(instructor)
    db.refresh(user)

    return _build_instructor_response(instructor, user)


@router.get("/{instructor_id}", response_model=InstructorResponse)
def get_instructor(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Instructor not found"}},
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()
    return _build_instructor_response(instructor, user)


@router.post("/{instructor_id}/photo", response_model=InstructorResponse)
@limiter.limit("20/minute", key_func=get_jwt_sub)
async def upload_instructor_photo(
    request: Request,
    instructor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    instructor: Instructor = Depends(_authorize_instructor_photo_upload),
):
    content = await file.read()
    new_filename = validate_and_save_photo(file, content, prefix=f"instructor_{instructor_id}")

    old_photo_path = instructor.photo_path
    instructor.photo_path = new_filename
    db.commit()
    db.refresh(instructor)

    if old_photo_path:
        delete_old_photo(old_photo_path)

    user = db.query(User).filter(User.id == instructor.user_id).first()
    return _build_instructor_response(instructor, user)


@router.put("/{instructor_id}", response_model=InstructorResponse)
def update_instructor(
    instructor_id: int,
    payload: InstructorUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Instructor not found"}},
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()

    update_data = payload.model_dump(exclude_unset=True)
    if "full_name" in update_data:
        user.full_name = update_data.pop("full_name")
    if "bio" in update_data:
        instructor.bio = update_data["bio"]

    db.commit()
    db.refresh(instructor)
    db.refresh(user)
    return _build_instructor_response(instructor, user)


@router.delete("/{instructor_id}", status_code=204)
def deactivate_instructor(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Instructor not found"}},
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()
    user.is_active = False
    db.commit()


@router.delete("/{instructor_id}/remove", status_code=204)
def remove_instructor(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    from app.models.scheduled_class import ScheduledClass

    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Instructor not found"}},
        )
    has_classes = (
        db.query(ScheduledClass)
        .filter(
            ScheduledClass.instructor_id == instructor_id,
            ScheduledClass.status == "scheduled",
        )
        .first()
    )
    if has_classes:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "INSTRUCTOR_HAS_CLASSES",
                    "message": "Cannot remove an instructor that has scheduled classes",
                }
            },
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()
    db.delete(instructor)
    if user:
        db.delete(user)
    db.commit()
