from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_authenticated, require_manager
from app.database import get_db
from app.models.appointment_service import AppointmentService
from app.schemas.appointment_service import (
    AppointmentServiceCreate,
    AppointmentServiceResponse,
    AppointmentServiceUpdate,
)
from app.utils import raise_api_error

router = APIRouter(prefix="/api/v1", tags=["appointment-services"])


@router.get("/appointment-services", response_model=List[AppointmentServiceResponse])
def list_appointment_services(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    query = db.query(AppointmentService)
    if not include_inactive:
        query = query.filter(AppointmentService.is_active.is_(True))
    return query.all()


@router.post("/appointment-services", response_model=AppointmentServiceResponse, status_code=201)
def create_appointment_service(
    payload: AppointmentServiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    service = AppointmentService(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/appointment-services/{service_id}", response_model=AppointmentServiceResponse)
def get_appointment_service(
    service_id: int,
    db: Session = Depends(get_db),
    _token=Depends(require_authenticated),
):
    service = db.query(AppointmentService).filter(AppointmentService.id == service_id).first()
    if not service:
        raise_api_error("NOT_FOUND", "Appointment service not found", status_code=404)
    return service


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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


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
    return service
