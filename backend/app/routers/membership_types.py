from typing import List

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models.membership_type import MembershipType
from app.schemas.membership_type import (
    MembershipTypeCreate,
    MembershipTypeResponse,
    MembershipTypeUpdate,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["membership-types"])


@router.get("/membership-types", response_model=List[MembershipTypeResponse])
def list_membership_types(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(MembershipType)
    if not include_inactive:
        query = query.filter(MembershipType.is_active.is_(True))
    return query.all()


@router.post("/membership-types", response_model=MembershipTypeResponse, status_code=201)
def create_membership_type(
    payload: MembershipTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    mt = MembershipType(**payload.model_dump())
    db.add(mt)
    db.commit()
    db.refresh(mt)
    return mt


@router.get("/membership-types/{membership_type_id}", response_model=MembershipTypeResponse)
def get_membership_type(
    membership_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    mt = db.query(MembershipType).filter(MembershipType.id == membership_type_id).first()
    if not mt:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership type not found"}},
        )
    return mt


@router.put("/membership-types/{membership_type_id}", response_model=MembershipTypeResponse)
def update_membership_type(
    membership_type_id: int,
    payload: MembershipTypeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    mt = db.query(MembershipType).filter(MembershipType.id == membership_type_id).first()
    if not mt:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership type not found"}},
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(mt, field, value)
    db.commit()
    db.refresh(mt)
    return mt


@router.delete("/membership-types/{membership_type_id}", response_model=MembershipTypeResponse)
def deactivate_membership_type(
    membership_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    mt = db.query(MembershipType).filter(MembershipType.id == membership_type_id).first()
    if not mt:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership type not found"}},
        )
    mt.is_active = False
    db.commit()
    db.refresh(mt)
    return mt
