from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user, require_manager, hash_password
from app.models.user import User
from app.models.instructor import Instructor
from app.schemas.instructor import InstructorCreate, InstructorUpdate, InstructorResponse

router = APIRouter(prefix="/api/v1/instructors", tags=["instructors"])


def _build_instructor_response(instructor: Instructor, user: User) -> dict:
    return {
        "id": instructor.id,
        "user_id": instructor.user_id,
        "bio": instructor.bio,
        "full_name": user.full_name,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": instructor.created_at,
        "updated_at": instructor.updated_at,
    }


@router.get("", response_model=List[InstructorResponse])
def list_instructors(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    instructors = db.query(Instructor).all()
    result = []
    for inst in instructors:
        user = db.query(User).filter(User.id == inst.user_id).first()
        if user and user.is_active:
            result.append(_build_instructor_response(inst, user))
    return result


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
            detail={"error": {"code": "INSTRUCTOR_HAS_CLASSES", "message": "Cannot remove an instructor that has scheduled classes"}},
        )
    user = db.query(User).filter(User.id == instructor.user_id).first()
    db.delete(instructor)
    if user:
        db.delete(user)
    db.commit()
