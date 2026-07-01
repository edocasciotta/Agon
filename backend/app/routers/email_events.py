"""
Email Event Assignments — /api/v1/email/events
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import require_manager
from app.database import get_db
from app.models.email_event_assignment import EVENT_TYPES, EmailEventAssignment
from app.models.email_template import EmailTemplate

router = APIRouter(prefix="/api/v1/email/events", tags=["email-events"])


def _event_label(event_type: str) -> str:
    """Convert snake_case event type to Title Case label."""
    return event_type.replace("_", " ").capitalize()


class EventAssignBody(BaseModel):
    template_id: Optional[int] = None


@router.get("")
def list_event_assignments(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    assignments = {a.event_type: a for a in db.query(EmailEventAssignment).all()}
    result = []
    for et in EVENT_TYPES:
        assignment = assignments.get(et)
        template_info = None
        if assignment and assignment.template_id:
            tmpl = (
                db.query(EmailTemplate).filter(EmailTemplate.id == assignment.template_id).first()
            )
            if tmpl:
                template_info = {"id": tmpl.id, "name": tmpl.name}
        result.append(
            {
                "event_type": et,
                "label": _event_label(et),
                "template": template_info,
            }
        )
    return result


@router.put("/{event_type}", status_code=200)
def assign_template_to_event(
    event_type: str,
    payload: EventAssignBody,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    if event_type not in EVENT_TYPES:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {"code": "NOT_FOUND", "message": f"Event type '{event_type}' not found"}
            },
        )

    # Validate template_id if provided
    if payload.template_id is not None:
        tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == payload.template_id).first()
        if not tmpl:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
            )

    assignment = (
        db.query(EmailEventAssignment).filter(EmailEventAssignment.event_type == event_type).first()
    )

    if assignment:
        assignment.template_id = payload.template_id
    else:
        assignment = EmailEventAssignment(
            event_type=event_type,
            template_id=payload.template_id,
        )
        db.add(assignment)

    db.commit()
    db.refresh(assignment)

    template_info = None
    if assignment.template_id:
        tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == assignment.template_id).first()
        if tmpl:
            template_info = {"id": tmpl.id, "name": tmpl.name}

    return {
        "event_type": event_type,
        "label": _event_label(event_type),
        "template": template_info,
    }
