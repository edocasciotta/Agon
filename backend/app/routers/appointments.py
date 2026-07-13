import logging
from datetime import date as date_type
from datetime import datetime, timedelta
from typing import List, Optional

from app.auth import decode_token, oauth2_scheme
from app.database import get_db
from app.limiter import get_jwt_sub, limiter
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.instructor import Instructor
from app.models.location import Location
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCompleteRequest,
    AppointmentCreate,
    AppointmentResponse,
    AvailableSlot,
)
from app.services.appointment_service import (
    compute_available_slots,
    get_active_instructor,
    has_conflicting_appointment,
    slot_fits_availability,
)
from app.services.booking_service import (
    calculate_fee,
    can_book,
    deduct_credit,
    get_active_membership,
    get_studio_settings,
    refund_credit,
)
from app.utils import raise_api_error, utcnow
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["appointments"])


# ---------------------------------------------------------------------------
# Helper: resolve caller role from token (mirrors bookings.py._resolve_caller)
# ---------------------------------------------------------------------------


def _resolve_caller(token: str, db: Session):
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise_api_error("AUTH_TOKEN_INVALID", "Token missing subject", status_code=401)

    return role, int(sub), payload


# ---------------------------------------------------------------------------
# GET /appointments/available-slots  (must be declared BEFORE /appointments/{id})
# ---------------------------------------------------------------------------


@router.get("/appointments/available-slots", response_model=List[AvailableSlot])
def get_available_slots(
    service_id: int = Query(...),
    instructor_id: int = Query(...),
    date: str = Query(...),
    db: Session = Depends(get_db),
    _token=Depends(oauth2_scheme),
):
    payload = decode_token(_token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)

    instructor = get_active_instructor(db, instructor_id)
    if not instructor:
        raise_api_error("NOT_FOUND", "Instructor not found", status_code=404)

    try:
        target_date = date_type.fromisoformat(date)
    except ValueError:
        raise_api_error(
            "VALIDATION_ERROR", "date must be an ISO-8601 date (YYYY-MM-DD)", status_code=422
        )

    slots = compute_available_slots(db, service, instructor_id, target_date)
    return slots


# ---------------------------------------------------------------------------
# Denormalisation helpers — mirrors the ScheduledClassResponse.template_name
# pattern in app/routers/classes.py (outerjoins + post-validation attribute
# assignment). Used only by the list/detail GET endpoints below.
# ---------------------------------------------------------------------------


def _appointment_enrichment_columns():
    return (
        AppointmentService.name.label("service_name"),
        User.full_name.label("instructor_name"),
        Location.name.label("location_name"),
    )


def _with_appointment_enrichment_joins(query):
    return (
        query.outerjoin(AppointmentService, Appointment.service_id == AppointmentService.id)
        .outerjoin(Instructor, Appointment.instructor_id == Instructor.id)
        .outerjoin(User, Instructor.user_id == User.id)
        .outerjoin(Location, Appointment.location_id == Location.id)
    )


def _appointment_row_to_response(row) -> AppointmentResponse:
    appointment, service_name, instructor_name, location_name = row
    response = AppointmentResponse.model_validate(appointment)
    response.service_name = service_name
    response.instructor_name = instructor_name
    response.location_name = location_name
    return response


# ---------------------------------------------------------------------------
# GET /appointments
# ---------------------------------------------------------------------------


@router.get("/appointments", response_model=List[AppointmentResponse])
def list_appointments(
    instructor_id: Optional[int] = Query(None),
    client_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    query = _with_appointment_enrichment_joins(
        db.query(Appointment, *_appointment_enrichment_columns())
    )

    if role in ("manager", "instructor"):
        if instructor_id is not None:
            query = query.filter(Appointment.instructor_id == instructor_id)
        if client_id is not None:
            query = query.filter(Appointment.client_id == client_id)
    else:
        # client — forced to own client_id only, regardless of what was passed
        query = query.filter(Appointment.client_id == subject_id)
        if instructor_id is not None:
            query = query.filter(Appointment.instructor_id == instructor_id)

    if start_date:
        query = query.filter(Appointment.starts_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Appointment.starts_at <= datetime.fromisoformat(end_date))
    if status is not None:
        query = query.filter(Appointment.status == status)

    rows = query.order_by(Appointment.starts_at.desc()).all()
    return [_appointment_row_to_response(row) for row in rows]


# ---------------------------------------------------------------------------
# POST /appointments  (book an appointment)
# ---------------------------------------------------------------------------


@router.post("/appointments", response_model=AppointmentResponse, status_code=201)
@limiter.limit("10/minute", key_func=get_jwt_sub)
def create_appointment(
    request: Request,
    payload: AppointmentCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    # Determine target client — mixed-audience IDOR pattern (backend/CLAUDE.md
    # Authorization section): reject a client caller whose sub != target client_id.
    if role in ("manager", "instructor"):
        if payload.client_id is None:
            raise_api_error(
                "VALIDATION_ERROR", "client_id required for manager/instructor", status_code=422
            )
        target_client_id = payload.client_id
    else:
        if payload.client_id is not None and str(payload.client_id) != str(subject_id):
            raise_api_error(
                "AUTH_INSUFFICIENT_PERMISSIONS",
                "Clients may only book appointments for themselves",
                status_code=403,
            )
        target_client_id = subject_id

    # 1. Service and instructor must both be active.
    service = (
        db.query(AppointmentService).filter(AppointmentService.id == payload.service_id).first()
    )
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)
    if not service.is_active:
        raise_api_error(
            "APPOINTMENT_SERVICE_INACTIVE", "This service is not currently offered", status_code=409
        )

    instructor = get_active_instructor(db, payload.instructor_id)
    if not instructor:
        raise_api_error("NOT_FOUND", "Instructor not found", status_code=404)

    instructor_user = db.query(User).filter(User.id == instructor.user_id).first()
    if not instructor_user or not instructor_user.is_active:
        raise_api_error(
            "APPOINTMENT_INSTRUCTOR_INACTIVE",
            "This instructor is not currently active",
            status_code=409,
        )

    # 2. Requested starts_at must not be in the past.
    now = utcnow()
    starts_at = payload.starts_at.replace(tzinfo=None)
    if starts_at <= now:
        raise_api_error(
            "APPOINTMENT_IN_PAST", "Requested start time is in the past", status_code=409
        )

    ends_at = starts_at + timedelta(minutes=service.duration_minutes)

    # 3. Requested slot must fit inside the instructor's availability for that weekday.
    if not slot_fits_availability(db, payload.instructor_id, starts_at, ends_at):
        raise_api_error(
            "APPOINTMENT_OUTSIDE_AVAILABILITY",
            "Requested time is outside the instructor's availability",
            status_code=409,
        )

    # 4. No overlap with the instructor's existing confirmed appointments,
    #    accounting for buffer_minutes on both sides.
    if has_conflicting_appointment(
        db, payload.instructor_id, starts_at, ends_at, service.buffer_minutes
    ):
        raise_api_error(
            "APPOINTMENT_SLOT_CONFLICT",
            "This time slot conflicts with another appointment",
            status_code=409,
        )

    # 5. Client must have an active membership with available credits.
    studio_settings = get_studio_settings(db)
    if not can_book(db, target_client_id, studio_settings):
        raise_api_error("BOOKING_NO_MEMBERSHIP", "No valid membership or credits", status_code=403)

    # 6. Create the appointment, deduct one credit.
    appointment = Appointment(
        service_id=payload.service_id,
        instructor_id=payload.instructor_id,
        client_id=target_client_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status="confirmed",
        credit_deducted=False,
        notes=payload.notes,
    )
    db.add(appointment)
    db.flush()

    membership = get_active_membership(db, target_client_id)
    credit_deducted = deduct_credit(db, membership)
    appointment.credit_deducted = credit_deducted

    db.commit()
    db.refresh(appointment)

    logger.info(
        f"Appointment created: client_id={target_client_id}, "
        f"instructor_id={payload.instructor_id}, service_id={payload.service_id}"
    )
    return appointment


# ---------------------------------------------------------------------------
# GET /appointments/{id}
# ---------------------------------------------------------------------------


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    row = (
        _with_appointment_enrichment_joins(
            db.query(Appointment, *_appointment_enrichment_columns())
        )
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not row:
        raise_api_error("NOT_FOUND", "Appointment not found", status_code=404)

    appointment = row[0]
    if role == "client" and appointment.client_id != subject_id:
        raise_api_error("AUTH_INSUFFICIENT_PERMISSIONS", "Not your appointment", status_code=403)

    return _appointment_row_to_response(row)


# ---------------------------------------------------------------------------
# PATCH /appointments/{id}/cancel
# ---------------------------------------------------------------------------


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    payload: AppointmentCancelRequest = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if payload is None:
        payload = AppointmentCancelRequest()

    role, subject_id, _ = _resolve_caller(token, db)

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise_api_error("NOT_FOUND", "Appointment not found", status_code=404)

    if role == "client" and appointment.client_id != subject_id:
        raise_api_error("AUTH_INSUFFICIENT_PERMISSIONS", "Not your appointment", status_code=403)

    if appointment.status != "confirmed":
        raise_api_error(
            "APPOINTMENT_ALREADY_CANCELLED", "Appointment is not confirmed", status_code=409
        )

    # Reuse the §7.2 cancellation-policy logic (late-cancellation window,
    # credit refund/no-refund) — same studio-settings-driven policy math
    # bookings.py.cancel_booking uses, applied to the appointment's own start.
    studio_settings = get_studio_settings(db)
    cancellation_deducts_credit = (
        getattr(studio_settings, "cancellation_deducts_credit", False) if studio_settings else False
    )
    cancellation_hours = getattr(studio_settings, "cancellation_hours", 2) if studio_settings else 2

    now = utcnow()
    hours_until = (appointment.starts_at - now).total_seconds() / 3600
    is_late = (hours_until < cancellation_hours) and (role == "client")

    appointment.status = "cancelled"
    appointment.cancelled_at = now
    appointment.cancellation_reason = payload.reason

    if not (is_late and cancellation_deducts_credit):
        membership = get_active_membership(db, appointment.client_id)
        refund_credit(db, membership, appointment.credit_deducted)

    fee_charged = None
    if is_late:
        fee_amount = calculate_fee(db, appointment.client_id, "late_cancel")
        if fee_amount > 0:
            from app.models.payment import Payment

            payment = Payment(
                client_id=appointment.client_id,
                amount=fee_amount,
                currency="EUR",
                status="completed",
                provider="system",
                notes="appointment_late_cancel_fee",
                paid_at=now,
            )
            db.add(payment)
            fee_charged = fee_amount

    db.commit()
    db.refresh(appointment)

    response = AppointmentResponse.model_validate(appointment)
    # fee_charged is informational only; not part of the persisted model, so
    # it is not exposed on AppointmentResponse (unlike BookingResponse) to
    # avoid a schema field that source is not settable from DB — logged instead.
    if fee_charged is not None:
        logger.info(
            f"Late-cancel fee charged: appointment_id={appointment.id}, amount={fee_charged}"
        )
    return response


# ---------------------------------------------------------------------------
# PATCH /appointments/{id}/complete
# ---------------------------------------------------------------------------


@router.patch("/appointments/{appointment_id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    appointment_id: int,
    payload: AppointmentCompleteRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id, _ = _resolve_caller(token, db)

    if role not in ("manager", "instructor"):
        raise_api_error("AUTH_INSUFFICIENT_PERMISSIONS", "Staff access required", status_code=403)

    if payload.status not in ("completed", "no_show"):
        raise_api_error(
            "VALIDATION_ERROR", "status must be 'completed' or 'no_show'", status_code=422
        )

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise_api_error("NOT_FOUND", "Appointment not found", status_code=404)

    if appointment.status != "confirmed":
        raise_api_error(
            "APPOINTMENT_NOT_CONFIRMED", "Appointment is not confirmed", status_code=409
        )

    appointment.status = payload.status

    fee_charged = None
    if payload.status == "no_show":
        fee_amount = calculate_fee(db, appointment.client_id, "no_show")
        if fee_amount > 0:
            from app.models.payment import Payment

            now = utcnow()
            payment = Payment(
                client_id=appointment.client_id,
                amount=fee_amount,
                currency="EUR",
                status="completed",
                provider="system",
                notes="appointment_no_show_fee",
                paid_at=now,
            )
            db.add(payment)
            fee_charged = fee_amount

    db.commit()
    db.refresh(appointment)

    if fee_charged is not None:
        logger.info(f"No-show fee charged: appointment_id={appointment.id}, amount={fee_charged}")
    return appointment
