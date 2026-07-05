import base64
import logging
from datetime import timedelta
from io import BytesIO
from typing import List

import qrcode
from app.auth import create_qr_token, decode_qr_token, decode_token, oauth2_scheme
from app.database import get_db
from app.models.booking import Booking
from app.models.checkin import Checkin
from app.models.client import Client
from app.models.scheduled_class import ScheduledClass
from app.schemas.checkin import CheckinCreate, CheckinResponse, QRCodeResponse
from app.services.booking_service import get_studio_settings
from app.utils import utcnow
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["checkins"])

# Default window values (minutes) when no studio settings exist
DEFAULT_OPEN_MINUTES_BEFORE = 15
DEFAULT_CLOSE_MINUTES_AFTER = 15


def _resolve_caller(token: str, db: Session):
    """
    Returns (role, subject_id, payload) where role is 'manager'|'instructor'|'client'
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


def _validate_and_checkin(
    db: Session,
    booking: Booking,
    method: str,
    role: str,
    subject_id: int,
) -> Checkin:
    """
    Shared validation logic for all check-in methods (steps 4–9).
    Returns a newly committed Checkin.
    """
    # Step 4: booking must be confirmed
    if booking.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CHECKIN_BOOKING_NOT_CONFIRMED",
                    "message": "Booking is not in confirmed status",
                }
            },
        )

    # Step 5: no existing check-in for this booking
    existing = db.query(Checkin).filter(Checkin.booking_id == booking.id).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CHECKIN_ALREADY_CHECKED_IN",
                    "message": "Client is already checked in for this class",
                }
            },
        )

    # Step 6: load studio settings (use defaults if none configured)
    studio_settings = get_studio_settings(db)
    open_minutes = (
        studio_settings.checkin_open_minutes_before
        if studio_settings
        else DEFAULT_OPEN_MINUTES_BEFORE
    )
    close_minutes = (
        studio_settings.checkin_close_minutes_after
        if studio_settings
        else DEFAULT_CLOSE_MINUTES_AFTER
    )

    # Step 7: check time window
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == booking.scheduled_class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )

    now = utcnow()
    window_open = sc.starts_at - timedelta(minutes=open_minutes)
    window_close = sc.starts_at + timedelta(minutes=close_minutes)

    if now < window_open:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CHECKIN_WINDOW_NOT_OPEN",
                    "message": f"Check-in opens at {window_open.isoformat()}",
                }
            },
        )

    if now > window_close:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CHECKIN_WINDOW_CLOSED",
                    "message": f"Check-in closed at {window_close.isoformat()}",
                }
            },
        )

    # Step 8: create the check-in record
    checked_in_by = subject_id if role in ("manager", "instructor") else None
    checkin = Checkin(
        booking_id=booking.id,
        client_id=booking.client_id,
        scheduled_class_id=booking.scheduled_class_id,
        method=method,
        checked_in_at=now,
        checked_in_by=checked_in_by,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def _checkin_response(checkin: Checkin, db: Session) -> CheckinResponse:
    """Build a CheckinResponse, loading the client's full_name."""
    client_obj = db.query(Client).filter(Client.id == checkin.client_id).first()
    client_name = client_obj.full_name if client_obj else "Unknown"
    return CheckinResponse(
        id=checkin.id,
        booking_id=checkin.booking_id,
        client_id=checkin.client_id,
        scheduled_class_id=checkin.scheduled_class_id,
        method=checkin.method,
        checked_in_at=checkin.checked_in_at,
        checked_in_by=checkin.checked_in_by,
        client_name=client_name,
    )


# ---------------------------------------------------------------------------
# GET /checkins/qr/{booking_id} — Generate QR code
# (must be declared BEFORE parameterised routes if any)
# ---------------------------------------------------------------------------


@router.get("/checkins/qr/{booking_id}", response_model=QRCodeResponse)
def generate_qr_code(
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

    # Client can only get QR for their own booking
    if role == "client" and booking.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Not your booking",
                }
            },
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CHECKIN_BOOKING_NOT_CONFIRMED",
                    "message": "Booking is not confirmed",
                }
            },
        )

    qr_token = create_qr_token(booking_id)

    # Generate QR image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode()

    return QRCodeResponse(
        booking_id=booking_id,
        qr_token=qr_token,
        qr_image_base64=b64,
    )


# ---------------------------------------------------------------------------
# GET /checkins/class/{class_id} — List all check-ins for a class
# ---------------------------------------------------------------------------


@router.get("/checkins/class/{class_id}", response_model=List[CheckinResponse])
def list_checkins_for_class(
    class_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    # Only manager/instructor may list check-ins
    if role == "client":
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Staff access required",
                }
            },
        )

    checkins = db.query(Checkin).filter(Checkin.scheduled_class_id == class_id).all()

    return [_checkin_response(c, db) for c in checkins]


# ---------------------------------------------------------------------------
# POST /checkins — Check in (all three methods)
# ---------------------------------------------------------------------------


@router.post("/checkins", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
def create_checkin(
    payload: CheckinCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    method = payload.method

    if method == "app":
        # Client self-check-in via mobile
        if payload.booking_id is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "booking_id required for app check-in",
                    }
                },
            )
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "Booking not found"}},
            )
        # Client can only check in their own booking
        if role == "client" and booking.client_id != subject_id:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                        "message": "Not your booking",
                    }
                },
            )

    elif method == "qr":
        # Client scans QR at reception kiosk
        if payload.qr_token is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "qr_token required for QR check-in",
                    }
                },
            )
        qr_payload = decode_qr_token(payload.qr_token)
        booking_id_from_qr = qr_payload.get("booking_id")
        booking = db.query(Booking).filter(Booking.id == booking_id_from_qr).first()
        if not booking:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "Booking not found"}},
            )
        # If client role: verify ownership
        if role == "client" and booking.client_id != subject_id:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                        "message": "Not your booking",
                    }
                },
            )

    elif method == "manual":
        # Manager/instructor marks client as present
        if role == "client":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                        "message": "Staff access required for manual check-in",
                    }
                },
            )
        if payload.scheduled_class_id is None or payload.client_id is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "scheduled_class_id and client_id required for manual check-in",
                    }
                },
            )
        booking = (
            db.query(Booking)
            .filter(
                Booking.client_id == payload.client_id,
                Booking.scheduled_class_id == payload.scheduled_class_id,
                Booking.status == "confirmed",
            )
            .first()
        )
        if not booking:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": "CHECKIN_BOOKING_NOT_FOUND",
                        "message": "No confirmed booking found for this client and class",
                    }
                },
            )

    else:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "method must be 'app', 'qr', or 'manual'",
                }
            },
        )

    checkin = _validate_and_checkin(db, booking, method, role, subject_id)
    return _checkin_response(checkin, db)
