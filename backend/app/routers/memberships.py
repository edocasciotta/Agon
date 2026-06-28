from app.utils import utcnow
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import require_manager, oauth2_scheme, decode_token
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.client import Client
from app.schemas.membership import MembershipCreate, MembershipUpdate, MembershipResponse, MembershipPauseRequest

router = APIRouter(prefix="/api/v1", tags=["memberships"])


def _resolve_caller(token: str):
    """Returns (role, subject_id) from token."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )
    return role, int(sub)


def _get_or_404(db: Session, membership_id: int) -> Membership:
    m = db.query(Membership).filter(Membership.id == membership_id).first()
    if not m:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership not found"}},
        )
    return m


@router.get("/memberships", response_model=List[MembershipResponse])
def list_memberships(
    client_id: int = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    if role in ("manager", "instructor"):
        query = db.query(Membership)
        if client_id:
            query = query.filter(Membership.client_id == client_id)
        return query.all()
    else:
        return db.query(Membership).filter(Membership.client_id == subject_id).all()


@router.post("/memberships", response_model=MembershipResponse, status_code=201)
def assign_membership(
    payload: MembershipCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    mt = db.query(MembershipType).filter(MembershipType.id == payload.membership_type_id).first()
    if not mt or not mt.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership type not found or inactive"}},
        )

    expires_at = payload.expires_at
    if expires_at is None and mt.validity_days is not None:
        expires_at = payload.starts_at + timedelta(days=mt.validity_days)

    credits_remaining = payload.credits_remaining
    if credits_remaining is None:
        credits_remaining = mt.credits_included

    membership = Membership(
        client_id=payload.client_id,
        membership_type_id=payload.membership_type_id,
        status="active",
        starts_at=payload.starts_at,
        expires_at=expires_at,
        credits_remaining=credits_remaining,
        credits_used=0,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


@router.get("/memberships/{membership_id}", response_model=MembershipResponse)
def get_membership(
    membership_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    m = _get_or_404(db, membership_id)
    if role not in ("manager", "instructor") and m.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Access denied"}},
        )
    return m


@router.put("/memberships/{membership_id}", response_model=MembershipResponse)
def update_membership(
    membership_id: int,
    payload: MembershipUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    m = _get_or_404(db, membership_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/memberships/{membership_id}", response_model=MembershipResponse)
def cancel_membership(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    m = _get_or_404(db, membership_id)
    m.status = "cancelled"
    db.commit()
    db.refresh(m)
    return m


@router.post("/memberships/{membership_id}/pause", response_model=MembershipResponse)
def pause_membership(
    membership_id: int,
    payload: MembershipPauseRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    m = _get_or_404(db, membership_id)

    mt = db.query(MembershipType).filter(MembershipType.id == m.membership_type_id).first()

    # Clients can only pause their own, and only if type allows it
    if role not in ("manager", "instructor"):
        if m.client_id != subject_id:
            raise HTTPException(
                status_code=403,
                detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Access denied"}},
            )

    if m.status != "active":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "MEMBERSHIP_NOT_ACTIVE", "message": "Membership is not active"}},
        )

    if not mt or not mt.can_pause:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "MEMBERSHIP_CANNOT_PAUSE", "message": "This membership type cannot be paused"}},
        )

    if mt.max_pause_days is not None and payload.pause_days > mt.max_pause_days:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "MEMBERSHIP_PAUSE_TOO_LONG", "message": f"Maximum pause is {mt.max_pause_days} days"}},
        )

    now = utcnow()
    m.status = "paused"
    m.paused_at = now
    m.pause_ends_at = now + timedelta(days=payload.pause_days)

    if m.expires_at is not None:
        m.expires_at = m.expires_at + timedelta(days=payload.pause_days)

    db.commit()
    db.refresh(m)
    return m


@router.post("/memberships/{membership_id}/resume", response_model=MembershipResponse)
def resume_membership(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    m = _get_or_404(db, membership_id)
    m.status = "active"
    m.paused_at = None
    m.pause_ends_at = None
    db.commit()
    db.refresh(m)
    return m
