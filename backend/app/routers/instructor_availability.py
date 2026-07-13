from typing import List, Optional

from app.auth import require_authenticated, require_staff
from app.database import get_db
from app.models.appointment_service import AppointmentService
from app.models.instructor import Instructor
from app.models.instructor_availability import InstructorAvailability
from app.schemas.instructor_availability import (
    InstructorAvailabilityCreate,
    InstructorAvailabilityResponse,
)
from app.utils import raise_api_error
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["instructor-availability"])


def _assert_can_manage(current_user, instructor: Instructor) -> None:
    """Manager can manage any instructor's availability; an instructor may only
    manage their own (instructor.user_id == current_user.id)."""
    if current_user.role == "manager":
        return
    if current_user.role == "instructor" and instructor.user_id == current_user.id:
        return
    raise_api_error(
        "AUTH_INSUFFICIENT_PERMISSIONS",
        "You may only manage your own availability",
        status_code=403,
    )


@router.get("/instructor-availability", response_model=List[InstructorAvailabilityResponse])
def list_instructor_availability(
    instructor_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    query = db.query(InstructorAvailability)
    if instructor_id is not None:
        query = query.filter(InstructorAvailability.instructor_id == instructor_id)
    return query.order_by(
        InstructorAvailability.instructor_id, InstructorAvailability.day_of_week
    ).all()


@router.post(
    "/instructor-availability", response_model=InstructorAvailabilityResponse, status_code=201
)
def create_instructor_availability(
    payload: InstructorAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
):
    instructor = db.query(Instructor).filter(Instructor.id == payload.instructor_id).first()
    if not instructor:
        raise_api_error("NOT_FOUND", "Instructor not found", status_code=404)

    _assert_can_manage(current_user, instructor)

    if payload.service_id is not None:
        service = (
            db.query(AppointmentService).filter(AppointmentService.id == payload.service_id).first()
        )
        if not service:
            raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)

    availability = InstructorAvailability(**payload.model_dump())
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


@router.delete("/instructor-availability/{availability_id}", status_code=204)
def delete_instructor_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
):
    availability = (
        db.query(InstructorAvailability)
        .filter(InstructorAvailability.id == availability_id)
        .first()
    )
    if not availability:
        raise_api_error("NOT_FOUND", "Availability window not found", status_code=404)

    instructor = db.query(Instructor).filter(Instructor.id == availability.instructor_id).first()
    _assert_can_manage(current_user, instructor)

    db.delete(availability)
    db.commit()
