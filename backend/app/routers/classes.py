import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models.booking import Booking
from app.models.client import Client
from app.models.scheduled_class import ScheduledClass
from app.models.waitlist import Waitlist
from app.schemas.scheduled_class import (
    RecurringClassCreate,
    RecurringClassResponse,
    ScheduledClassCreate,
    ScheduledClassResponse,
    ScheduledClassUpdate,
)
from app.utils import utcnow
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/classes", tags=["classes"])


# ---- /recurring must come BEFORE /{id} ----


@router.post(
    "/recurring", response_model=RecurringClassResponse, status_code=status.HTTP_201_CREATED
)
def schedule_recurring_classes(
    payload: RecurringClassCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    # Validate days_of_week
    for day in payload.days_of_week:
        if day < 0 or day > 6:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {"code": "VALIDATION_ERROR", "message": "days_of_week must be 0–6"}
                },
            )

    # Determine recurrence end
    recurrence_end = payload.recurrence_end_date
    if recurrence_end is None:
        recurrence_end = payload.starts_at + timedelta(days=365)

    # Duration of class
    duration = payload.ends_at - payload.starts_at

    recurrence_group_id = str(uuid.uuid4())
    instances = []

    # Iterate day-by-day from starts_at date to recurrence_end
    current_date = payload.starts_at.date()
    end_date = recurrence_end.date() if hasattr(recurrence_end, "date") else recurrence_end

    # Make sure we work with date objects
    if hasattr(end_date, "date"):
        end_date = end_date.date()

    # Iterate from the start date

    cursor = current_date

    while cursor <= end_date:
        if cursor.weekday() in payload.days_of_week:
            # Build the datetime for this occurrence
            occurrence_start = datetime(
                cursor.year,
                cursor.month,
                cursor.day,
                payload.starts_at.hour,
                payload.starts_at.minute,
                payload.starts_at.second,
            )
            occurrence_end = occurrence_start + duration
            sc = ScheduledClass(
                template_id=payload.template_id,
                instructor_id=payload.instructor_id,
                location_id=payload.location_id or 1,
                starts_at=occurrence_start,
                ends_at=occurrence_end,
                capacity=payload.capacity,
                notes=payload.notes,
                recurrence_group_id=recurrence_group_id,
                status="scheduled",
            )
            instances.append(sc)

            if payload.max_occurrences and len(instances) >= payload.max_occurrences:
                break

        cursor += timedelta(days=1)

    for sc in instances:
        db.add(sc)
    db.commit()

    return {"created_count": len(instances), "recurrence_group_id": recurrence_group_id}


# ---- Collection ----


@router.get("", response_model=List[ScheduledClassResponse])
def list_classes(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    instructor_id: Optional[int] = Query(None),
    template_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(ScheduledClass)
    if start_date:
        query = query.filter(ScheduledClass.starts_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ScheduledClass.starts_at <= datetime.fromisoformat(end_date))
    if instructor_id is not None:
        query = query.filter(ScheduledClass.instructor_id == instructor_id)
    if template_id is not None:
        query = query.filter(ScheduledClass.template_id == template_id)
    if location_id is not None:
        query = query.filter(ScheduledClass.location_id == location_id)
    if status is not None:
        query = query.filter(ScheduledClass.status == status)
    return query.order_by(ScheduledClass.starts_at).all()


@router.post("", response_model=ScheduledClassResponse, status_code=status.HTTP_201_CREATED)
def schedule_single_class(
    payload: ScheduledClassCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    sc = ScheduledClass(**payload.model_dump(), status="scheduled")
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


# ---- Individual class routes ----


@router.get("/{class_id}", response_model=ScheduledClassResponse)
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )
    return sc


@router.put("/{class_id}", response_model=ScheduledClassResponse)
def update_class(
    class_id: int,
    payload: ScheduledClassUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sc, field, value)
    db.commit()
    db.refresh(sc)
    return sc


@router.delete("/{class_id}", response_model=ScheduledClassResponse)
def cancel_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    from app.services.booking_service import get_active_membership, refund_credit

    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )

    now = utcnow()
    sc.status = "cancelled"

    # Cancel all confirmed bookings and refund credits
    confirmed_bookings = (
        db.query(Booking)
        .filter(Booking.scheduled_class_id == class_id, Booking.status == "confirmed")
        .all()
    )
    for booking in confirmed_bookings:
        booking.status = "cancelled"
        booking.cancelled_at = now
        booking.cancellation_reason = "Class cancelled by studio"
        if booking.credit_deducted:
            membership = get_active_membership(db, booking.client_id)
            refund_credit(db, membership, True)

    # Decline all waitlist entries
    waitlist_entries = db.query(Waitlist).filter(Waitlist.scheduled_class_id == class_id).all()
    for entry in waitlist_entries:
        entry.status = "declined"
        entry.updated_at = now

    db.commit()
    db.refresh(sc)
    return sc


@router.get("/{class_id}/roster")
def get_roster(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )
    bookings = (
        db.query(Booking)
        .filter(Booking.scheduled_class_id == class_id, Booking.status == "confirmed")
        .all()
    )
    result = []
    for booking in bookings:
        client = db.query(Client).filter(Client.id == booking.client_id).first()
        result.append(
            {
                "booking_id": booking.id,
                "client_id": booking.client_id,
                "full_name": client.full_name if client else None,
                "email": client.email if client else None,
                "status": booking.status,
            }
        )
    return result


@router.get("/{class_id}/waitlist")
def get_waitlist(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )
    entries = (
        db.query(Waitlist)
        .filter(Waitlist.scheduled_class_id == class_id)
        .order_by(Waitlist.position)
        .all()
    )
    return [
        {
            "id": e.id,
            "client_id": e.client_id,
            "position": e.position,
            "status": e.status,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@router.post("/{class_id}/complete", response_model=ScheduledClassResponse)
def complete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )
    sc.status = "completed"
    db.commit()
    db.refresh(sc)
    return sc


@router.delete("/{class_id}/remove", status_code=204)
def remove_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    """Permanently delete a scheduled class. Only allowed when there are no confirmed bookings."""
    sc = db.query(ScheduledClass).filter(ScheduledClass.id == class_id).first()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Scheduled class not found"}},
        )

    confirmed_count = (
        db.query(Booking)
        .filter(Booking.scheduled_class_id == class_id, Booking.status == "confirmed")
        .count()
    )
    if confirmed_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CLASS_HAS_BOOKINGS",
                    "message": f"Cannot remove: {confirmed_count} confirmed booking(s). Use 'Cancel' instead.",
                    "details": {"confirmed_count": confirmed_count},
                }
            },
        )

    # Decline any waitlist entries then hard-delete
    db.query(Waitlist).filter(Waitlist.scheduled_class_id == class_id).delete()
    db.delete(sc)
    db.commit()
