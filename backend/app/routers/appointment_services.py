from typing import List

from app.auth import require_authenticated, require_manager
from app.database import get_db
from app.models.appointment_service import AppointmentService
from app.models.appointment_service_location import AppointmentServiceLocation
from app.models.instructor import Instructor
from app.models.location import Location
from app.models.user import User
from app.routers.instructors import _build_instructor_response
from app.schemas.appointment_service import (
    AppointmentServiceCreate,
    AppointmentServiceResponse,
    AppointmentServiceUpdate,
)
from app.schemas.instructor import InstructorResponse
from app.services.appointment_service import (
    get_eligible_instructor_ids_for_service,
    get_service_location_ids,
)
from app.utils import raise_api_error
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["appointment-services"])


def _build_service_response(db: Session, service: AppointmentService) -> AppointmentServiceResponse:
    response = AppointmentServiceResponse.model_validate(service)
    response.establishment_ids = get_service_location_ids(db, service.id)
    return response


def _set_service_establishments(db: Session, service_id: int, establishment_ids: List[int]) -> None:
    """Replaces the entire set of locations linked to this service. An empty
    list is valid and means "no establishment scoping" (offered everywhere)."""
    unique_ids = sorted(set(establishment_ids))
    if unique_ids:
        found = db.query(Location.id).filter(Location.id.in_(unique_ids)).all()
        found_ids = {row[0] for row in found}
        missing = [i for i in unique_ids if i not in found_ids]
        if missing:
            raise_api_error(
                "NOT_FOUND",
                f"Location(s) not found: {missing}",
                status_code=404,
            )

    db.query(AppointmentServiceLocation).filter(
        AppointmentServiceLocation.service_id == service_id
    ).delete()
    for location_id in unique_ids:
        db.add(AppointmentServiceLocation(service_id=service_id, location_id=location_id))


@router.get("/appointment-services", response_model=List[AppointmentServiceResponse])
def list_appointment_services(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    query = db.query(AppointmentService)
    if not include_inactive:
        query = query.filter(AppointmentService.is_active.is_(True))
    services = query.all()
    return [_build_service_response(db, service) for service in services]


@router.post("/appointment-services", response_model=AppointmentServiceResponse, status_code=201)
def create_appointment_service(
    payload: AppointmentServiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    data = payload.model_dump(exclude={"establishment_ids"})
    service = AppointmentService(**data)
    db.add(service)
    db.flush()

    if payload.establishment_ids:
        _set_service_establishments(db, service.id, payload.establishment_ids)

    db.commit()
    db.refresh(service)
    return _build_service_response(db, service)


@router.get(
    "/appointment-services/{service_id}/available-instructors",
    response_model=List[InstructorResponse],
)
def list_available_instructors_for_service(
    service_id: int,
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    """Instructors eligible for this service: at least one active
    availability window scoped to the service (NULL-service_id windows are
    wildcards for every service), and — when the service is scoped to
    specific establishments — whose own location matches one of them (a
    service with no establishment links is open to instructors anywhere).

    This does NOT filter by a specific date/day; `GET
    /appointments/available-slots` already does that per-instructor. This
    endpoint only narrows down which instructors are eligible at all.
    """
    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)

    eligible_instructor_ids = get_eligible_instructor_ids_for_service(db, service_id)
    if not eligible_instructor_ids:
        return []

    location_ids = get_service_location_ids(db, service_id)

    query = db.query(Instructor).filter(Instructor.id.in_(eligible_instructor_ids))
    if location_ids:
        query = query.filter(Instructor.location_id.in_(location_ids))

    result = []
    for instructor in query.all():
        user = db.query(User).filter(User.id == instructor.user_id).first()
        if user and user.is_active:
            result.append(_build_instructor_response(instructor, user))
    return result


@router.get("/appointment-services/{service_id}", response_model=AppointmentServiceResponse)
def get_appointment_service(
    service_id: int,
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)
    return _build_service_response(db, service)


@router.patch("/appointment-services/{service_id}", response_model=AppointmentServiceResponse)
def update_appointment_service(
    service_id: int,
    payload: AppointmentServiceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)
    update_data = payload.model_dump(exclude_unset=True, exclude={"establishment_ids"})
    for field, value in update_data.items():
        setattr(service, field, value)

    if payload.establishment_ids is not None:
        _set_service_establishments(db, service.id, payload.establishment_ids)

    db.commit()
    db.refresh(service)
    return _build_service_response(db, service)


@router.delete("/appointment-services/{service_id}", response_model=AppointmentServiceResponse)
def deactivate_appointment_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    """Soft-delete: deactivate the service (reversible via PATCH is_active=true).

    This endpoint never hard-deletes — appointment history referencing the
    service must be preserved, consistent with the "deactivate = reversible"
    convention established for membership types. There is no companion
    hard-delete route for appointment services in this round.
    """
    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)

    service.is_active = False
    db.commit()
    db.refresh(service)
    return _build_service_response(db, service)
