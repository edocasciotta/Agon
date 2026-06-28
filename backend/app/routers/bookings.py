from app.utils import utcnow
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import oauth2_scheme, decode_token, get_current_client
from app.models.booking import Booking
from app.models.waitlist import Waitlist
from app.models.scheduled_class import ScheduledClass
from app.models.client import Client
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingCancelRequest,
    WaitlistJoinRequest,
    WaitlistResponse,
)
from app.services.booking_service import (
    can_book,
    deduct_credit,
    get_active_membership,
    get_studio_settings,
    process_waitlist,
    refund_credit,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["bookings"])


# ---------------------------------------------------------------------------
# Helper: resolve caller role from token
# ---------------------------------------------------------------------------

def _resolve_caller(token: str, db: Session):
    """
    Returns (role, subject_id) where role is 'manager'|'instructor'|'client'
    and subject_id is the integer id of the authenticated entity.
    """
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

    return role, int(sub), payload


# ---------------------------------------------------------------------------
# GET /bookings
# ---------------------------------------------------------------------------

@router.get("/bookings", response_model=List[BookingResponse])
def list_bookings(
    client_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    if role in ("manager", "instructor"):
        query = db.query(Booking)
        if client_id is not None:
            query = query.filter(Booking.client_id == client_id)
        if class_id is not None:
            query = query.filter(Booking.scheduled_class_id == class_id)
    else:
        # client — only own bookings
        query = db.query(Booking).filter(Booking.client_id == subject_id)
        if class_id is not None:
            query = query.filter(Booking.scheduled_class_id == class_id)

    return query.order_by(Booking.created_at.desc()).all()


# ---------------------------------------------------------------------------
# POST /bookings/waitlist  (must be declared BEFORE /bookings/{id})
# ---------------------------------------------------------------------------

@router.post("/bookings/waitlist", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
def join_waitlist(
    payload: WaitlistJoinRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    # Determine target client
    if role in ("manager", "instructor"):
        if payload.client_id is None:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "VALIDATION_ERROR", "message": "client_id required for manager"}},
            )
        target_client_id = payload.client_id
    else:
        target_client_id = subject_id

    # Fetch class
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == payload.scheduled_class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )

    if sc.status != "scheduled":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_CLASS_NOT_SCHEDULED", "message": "Class is not scheduled"}},
        )

    now = utcnow()
    if sc.starts_at <= now:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_CLASS_ALREADY_STARTED", "message": "Class has already started"}},
        )

    # Check no existing waitlist entry
    existing_wl = db.query(Waitlist).filter(
        Waitlist.client_id == target_client_id,
        Waitlist.scheduled_class_id == payload.scheduled_class_id,
    ).first()
    if existing_wl:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_WAITLIST_DUPLICATE", "message": "Already on the waitlist"}},
        )

    # Check no confirmed booking (already booked = no need for waitlist)
    existing_booking = db.query(Booking).filter(
        Booking.client_id == target_client_id,
        Booking.scheduled_class_id == payload.scheduled_class_id,
        Booking.status == "confirmed",
    ).first()
    if existing_booking:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_DUPLICATE", "message": "Already booked for this class"}},
        )

    # Get next position
    max_pos = db.query(func.max(Waitlist.position)).filter(
        Waitlist.scheduled_class_id == payload.scheduled_class_id
    ).scalar()
    next_pos = (max_pos or 0) + 1

    entry = Waitlist(
        client_id=target_client_id,
        scheduled_class_id=payload.scheduled_class_id,
        position=next_pos,
        status="waiting",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# DELETE /bookings/waitlist/{waitlist_id}
# ---------------------------------------------------------------------------

@router.delete("/bookings/waitlist/{waitlist_id}", response_model=WaitlistResponse)
def leave_waitlist(
    waitlist_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    entry = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not entry:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Waitlist entry not found"}},
        )

    if role == "client" and entry.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Not your waitlist entry"}},
        )

    entry.status = "declined"
    entry.updated_at = utcnow()
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# POST /bookings/waitlist/{waitlist_id}/confirm
# ---------------------------------------------------------------------------

@router.post("/bookings/waitlist/{waitlist_id}/confirm", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def confirm_waitlist(
    waitlist_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    entry = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not entry:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Waitlist entry not found"}},
        )

    if role == "client" and entry.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Not your waitlist entry"}},
        )

    if entry.status != "offered":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "WAITLIST_OFFER_NOT_ACTIVE", "message": "Waitlist offer is not active"}},
        )

    now = utcnow()
    if entry.offer_expires_at and entry.offer_expires_at <= now:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "WAITLIST_OFFER_EXPIRED", "message": "Waitlist offer has expired"}},
        )

    studio_settings = get_studio_settings(db)

    if not can_book(db, entry.client_id, studio_settings):
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "BOOKING_NO_MEMBERSHIP", "message": "No valid membership or credits"}},
        )

    # Race condition safety: check capacity again
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == entry.scheduled_class_id).first()
    confirmed_count = db.query(Booking).filter(
        Booking.scheduled_class_id == entry.scheduled_class_id,
        Booking.status == "confirmed",
    ).count()
    if confirmed_count >= sc.capacity:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_CLASS_FULL", "message": "Class is full"}},
        )

    booking = Booking(
        client_id=entry.client_id,
        scheduled_class_id=entry.scheduled_class_id,
        status="confirmed",
        credit_deducted=False,
    )
    db.add(booking)
    db.flush()

    membership = get_active_membership(db, entry.client_id)
    credit_deducted = deduct_credit(db, membership)
    booking.credit_deducted = credit_deducted

    entry.status = "confirmed"
    entry.updated_at = now

    db.commit()
    db.refresh(booking)
    return booking


# ---------------------------------------------------------------------------
# POST /bookings  (create booking)
# ---------------------------------------------------------------------------

@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    # Determine target client
    if role in ("manager", "instructor"):
        if payload.client_id is None:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "VALIDATION_ERROR", "message": "client_id required for manager"}},
            )
        target_client_id = payload.client_id
    else:
        target_client_id = subject_id

    # Fetch class
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == payload.scheduled_class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )

    if sc.status != "scheduled":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_CLASS_NOT_SCHEDULED", "message": "Class is not scheduled"}},
        )

    now = utcnow()
    if sc.starts_at <= now:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_CLASS_ALREADY_STARTED", "message": "Class has already started"}},
        )

    # Check no duplicate confirmed booking
    existing = db.query(Booking).filter(
        Booking.client_id == target_client_id,
        Booking.scheduled_class_id == payload.scheduled_class_id,
        Booking.status == "confirmed",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_DUPLICATE", "message": "Already booked for this class"}},
        )

    # Studio settings
    studio_settings = get_studio_settings(db)

    # Check booking eligibility
    if not can_book(db, target_client_id, studio_settings):
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "BOOKING_NO_MEMBERSHIP", "message": "No valid membership or credits"}},
        )

    # Check capacity
    confirmed_count = db.query(Booking).filter(
        Booking.scheduled_class_id == payload.scheduled_class_id,
        Booking.status == "confirmed",
    ).count()
    if confirmed_count >= sc.capacity:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "BOOKING_CLASS_FULL",
                    "message": "Class is full. Join the waitlist?",
                    "waitlist_available": True,
                }
            },
        )

    # Create booking
    booking = Booking(
        client_id=target_client_id,
        scheduled_class_id=payload.scheduled_class_id,
        status="confirmed",
        credit_deducted=False,
    )
    db.add(booking)
    db.flush()

    membership = get_active_membership(db, target_client_id)
    credit_deducted = deduct_credit(db, membership)
    booking.credit_deducted = credit_deducted

    db.commit()
    db.refresh(booking)

    logger.info(f"Booking created: client_id={target_client_id}, class_id={payload.scheduled_class_id}")
    return booking


# ---------------------------------------------------------------------------
# GET /bookings/{id}
# ---------------------------------------------------------------------------

@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Booking not found"}},
        )

    if role == "client" and booking.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Not your booking"}},
        )

    return booking


# ---------------------------------------------------------------------------
# DELETE /bookings/{id}  (cancel booking)
# ---------------------------------------------------------------------------

@router.delete("/bookings/{booking_id}", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    payload: BookingCancelRequest = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if payload is None:
        payload = BookingCancelRequest()

    role, subject_id, _ = _resolve_caller(token, db)

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Booking not found"}},
        )

    if role == "client" and booking.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Not your booking"}},
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "BOOKING_ALREADY_CANCELLED", "message": "Booking is not confirmed"}},
        )

    studio_settings = get_studio_settings(db)
    cancellation_hours = getattr(studio_settings, "cancellation_hours", 2) if studio_settings else 2
    cancellation_deducts_credit = getattr(studio_settings, "cancellation_deducts_credit", False) if studio_settings else False

    sc = db.query(ScheduledClass).filter(ScheduledClass.id == booking.scheduled_class_id).first()
    now = utcnow()
    hours_until = (sc.starts_at - now).total_seconds() / 3600

    is_late = (hours_until < cancellation_hours) and (role == "client")

    booking.status = "cancelled"
    booking.cancelled_at = now
    booking.cancellation_reason = payload.reason if payload else None

    # Refund credit unless it's a late cancellation with deduction enabled
    if not (is_late and cancellation_deducts_credit):
        membership = get_active_membership(db, booking.client_id)
        refund_credit(db, membership, booking.credit_deducted)

    db.commit()
    db.refresh(booking)

    # Trigger next waitlist offer
    if studio_settings:
        process_waitlist(db, booking.scheduled_class_id, studio_settings)

    return booking
