from datetime import timedelta
from typing import Optional

from app.auth import decode_token, oauth2_scheme, require_manager
from app.database import get_db
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.schemas.membership import (
    MembershipCreate,
    MembershipListPage,
    MembershipPauseRequest,
    MembershipResponse,
    MembershipUpdate,
)
from app.services.intro_offer_service import can_use_intro_offer
from app.services.tag_service import evaluate_auto_tags
from app.utils import raise_api_error, utcnow
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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


def _to_membership_response(
    membership: Membership, client_name: str, membership_type_name: str
) -> MembershipResponse:
    data = MembershipResponse.model_validate(membership).model_dump()
    data["client_name"] = client_name
    data["membership_type_name"] = membership_type_name
    return MembershipResponse(**data)


@router.get("/memberships", response_model=MembershipListPage)
def list_memberships(
    client_id: int = None,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    query = (
        db.query(Membership, Client.full_name, MembershipType.name)
        .join(Client, Membership.client_id == Client.id)
        .join(MembershipType, Membership.membership_type_id == MembershipType.id)
    )

    if role in ("manager", "instructor"):
        if client_id:
            query = query.filter(Membership.client_id == client_id)
    else:
        query = query.filter(Membership.client_id == subject_id)

    if status:
        query = query.filter(Membership.status == status)

    total = query.count()
    rows = (
        query.order_by(Membership.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        _to_membership_response(membership, client_name, membership_type_name)
        for membership, client_name, membership_type_name in rows
    ]
    return MembershipListPage(items=items, total=total, page=page, page_size=page_size)


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
            detail={
                "error": {"code": "NOT_FOUND", "message": "Membership type not found or inactive"}
            },
        )

    # Intro offer: enforce one-per-client-per-location
    if mt.is_intro_offer:
        if not can_use_intro_offer(db, payload.client_id, mt.location_id):
            raise_api_error(
                "INTRO_OFFER_ALREADY_USED",
                "This client has already used an intro offer at this location.",
                status_code=409,
            )

    expires_at = payload.expires_at
    if expires_at is None:
        validity = mt.validity_days
        if mt.is_intro_offer and mt.intro_validity_days is not None:
            validity = mt.intro_validity_days
        if validity is not None:
            expires_at = payload.starts_at + timedelta(days=validity)

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
    db.flush()

    evaluate_auto_tags(
        db,
        "membership_purchased",
        payload.client_id,
        {"membership_type_id": payload.membership_type_id},
    )

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
                detail={
                    "error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Access denied"}
                },
            )

    if m.status != "active":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {"code": "MEMBERSHIP_NOT_ACTIVE", "message": "Membership is not active"}
            },
        )

    if not mt or not mt.can_pause:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "MEMBERSHIP_CANNOT_PAUSE",
                    "message": "This membership type cannot be paused",
                }
            },
        )

    if mt.max_pause_days is not None and payload.pause_days > mt.max_pause_days:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "MEMBERSHIP_PAUSE_TOO_LONG",
                    "message": f"Maximum pause is {mt.max_pause_days} days",
                }
            },
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
