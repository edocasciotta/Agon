"""Appointment-specific scheduling helpers.

Credit deduction, refund, and cancellation-fee math are intentionally NOT
duplicated here — appointments reuse `app.services.booking_service`
(`get_active_membership`, `can_book`, `deduct_credit`, `refund_credit`,
`calculate_fee`, `get_studio_settings`) exactly as ScheduledClass bookings do,
since both share the same membership-credit mechanism (TECHNICAL_SPEC §7.1 /
§7.2). This module only adds the availability/slot-computation logic that has
no class-booking equivalent.
"""

from datetime import date, datetime, time, timedelta
from typing import List, Optional

from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.appointment_service_location import AppointmentServiceLocation
from app.models.instructor import Instructor
from app.models.instructor_availability import InstructorAvailability
from sqlalchemy import or_
from sqlalchemy.orm import Session


def get_availability_windows(
    db: Session, instructor_id: int, day_of_week: int, service_id: Optional[int] = None
) -> List[InstructorAvailability]:
    """Active availability windows for an instructor on a given weekday (0=Monday).

    When `service_id` is given, a window applies only if its own `service_id`
    is NULL (wildcard — available for ALL services, the value every
    pre-existing row has) or equal to the requested `service_id`. When
    `service_id` is omitted, no service-scoping filter is applied.
    """
    query = db.query(InstructorAvailability).filter(
        InstructorAvailability.instructor_id == instructor_id,
        InstructorAvailability.day_of_week == day_of_week,
        InstructorAvailability.is_active.is_(True),
    )
    if service_id is not None:
        query = query.filter(
            or_(
                InstructorAvailability.service_id.is_(None),
                InstructorAvailability.service_id == service_id,
            )
        )
    return query.order_by(InstructorAvailability.start_time).all()


def get_busy_intervals(
    db: Session, instructor_id: int, window_start: datetime, window_end: datetime
) -> List[tuple[datetime, datetime]]:
    """Confirmed appointments for the instructor overlapping [window_start, window_end),
    each expanded by that appointment's own service buffer_minutes on the trailing edge,
    so a candidate slot cannot start inside another appointment's buffer gap."""
    rows = (
        db.query(Appointment, AppointmentService)
        .join(AppointmentService, Appointment.service_id == AppointmentService.id)
        .filter(
            Appointment.instructor_id == instructor_id,
            Appointment.status == "confirmed",
            Appointment.starts_at < window_end,
            Appointment.ends_at > window_start,
        )
        .all()
    )
    busy = []
    for appt, svc in rows:
        buffered_end = appt.ends_at + timedelta(minutes=svc.buffer_minutes or 0)
        busy.append((appt.starts_at, buffered_end))
    return busy


def compute_available_slots(
    db: Session,
    service: AppointmentService,
    instructor_id: int,
    target_date: date,
    slot_step_minutes: Optional[int] = None,
) -> List[dict]:
    """Candidate {starts_at, ends_at} slots for a service+instructor on target_date.

    A slot is valid if it fits entirely inside one of the instructor's active
    availability windows for that weekday, and does not overlap any existing
    confirmed appointment for that instructor once each side's buffer_minutes
    is accounted for.
    """
    day_of_week = target_date.weekday()  # Monday=0 ... Sunday=6
    windows = get_availability_windows(db, instructor_id, day_of_week, service_id=service.id)
    if not windows:
        return []

    duration = timedelta(minutes=service.duration_minutes)
    buffer_after = timedelta(minutes=service.buffer_minutes or 0)
    step = timedelta(minutes=slot_step_minutes or service.duration_minutes)

    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)
    busy = get_busy_intervals(db, instructor_id, day_start, day_end)

    slots: List[dict] = []
    for window in windows:
        window_start = datetime.combine(target_date, window.start_time)
        window_end = datetime.combine(target_date, window.end_time)

        cursor = window_start
        while cursor + duration <= window_end:
            slot_start = cursor
            slot_end = cursor + duration
            # This appointment's own trailing buffer must also fit before the
            # next commitment, but not necessarily before window_end.
            occupied_end = slot_end + buffer_after

            conflict = any(
                slot_start < busy_end and occupied_end > busy_start for busy_start, busy_end in busy
            )
            if not conflict:
                slots.append({"starts_at": slot_start, "ends_at": slot_end})

            cursor += step

    return slots


def slot_fits_availability(
    db: Session,
    instructor_id: int,
    starts_at: datetime,
    ends_at: datetime,
    service_id: Optional[int] = None,
) -> bool:
    """True if [starts_at, ends_at) is fully contained within one of the
    instructor's active availability windows for that weekday, scoped to
    service_id (NULL window = wildcard, applies to every service)."""
    day_of_week = starts_at.weekday()
    windows = get_availability_windows(db, instructor_id, day_of_week, service_id=service_id)
    for window in windows:
        window_start = datetime.combine(starts_at.date(), window.start_time)
        window_end = datetime.combine(starts_at.date(), window.end_time)
        if starts_at >= window_start and ends_at <= window_end:
            return True
    return False


def has_conflicting_appointment(
    db: Session,
    instructor_id: int,
    starts_at: datetime,
    ends_at: datetime,
    buffer_minutes: int,
    exclude_appointment_id: Optional[int] = None,
) -> bool:
    """True if the candidate [starts_at, ends_at) (with buffer_minutes applied
    on both sides) overlaps any existing confirmed appointment for the
    instructor (each expanded by its own service's buffer_minutes)."""
    candidate_start = starts_at - timedelta(minutes=buffer_minutes)
    candidate_end = ends_at + timedelta(minutes=buffer_minutes)

    query = (
        db.query(Appointment, AppointmentService)
        .join(AppointmentService, Appointment.service_id == AppointmentService.id)
        .filter(
            Appointment.instructor_id == instructor_id,
            Appointment.status == "confirmed",
        )
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    for appt, svc in query.all():
        existing_start = appt.starts_at
        existing_end = appt.ends_at + timedelta(minutes=svc.buffer_minutes or 0)
        if candidate_start < existing_end and candidate_end > existing_start:
            return True
    return False


def get_active_instructor(db: Session, instructor_id: int) -> Optional[Instructor]:
    return db.query(Instructor).filter(Instructor.id == instructor_id).first()


def get_eligible_instructor_ids_for_service(db: Session, service_id: int) -> List[int]:
    """Instructor ids with at least one active availability window scoped to
    service_id (NULL window = wildcard, applies to every service). No
    date/day filtering here — that is `available-slots`'s job per-instructor;
    this is just "which instructors are even eligible for this service"."""
    rows = (
        db.query(InstructorAvailability.instructor_id)
        .filter(
            InstructorAvailability.is_active.is_(True),
            or_(
                InstructorAvailability.service_id.is_(None),
                InstructorAvailability.service_id == service_id,
            ),
        )
        .distinct()
        .all()
    )
    return [row[0] for row in rows]


def get_service_location_ids(db: Session, service_id: int) -> List[int]:
    """Location ids this service is explicitly linked to. Empty list means
    the service has no establishment scoping — offered at ALL locations."""
    rows = (
        db.query(AppointmentServiceLocation.location_id)
        .filter(AppointmentServiceLocation.service_id == service_id)
        .all()
    )
    return [row[0] for row in rows]
