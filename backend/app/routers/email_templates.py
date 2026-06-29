"""
Email Templates CRUD — /api/v1/email/templates
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import require_manager
from app.models.email_template import EmailTemplate
from app.models.email_event_assignment import EmailEventAssignment
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateResponse,
    EmailTemplateListItem,
)

router = APIRouter(prefix="/api/v1/email/templates", tags=["email-templates"])


@router.get("", response_model=List[EmailTemplateListItem])
def list_templates(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    return db.query(EmailTemplate).all()


@router.post("", response_model=EmailTemplateResponse, status_code=201)
def create_template(
    payload: EmailTemplateCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = EmailTemplate(
        name=payload.name,
        subject=payload.subject,
        html_body=payload.html_body,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.get("/{template_id}", response_model=EmailTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
        )
    return tmpl


@router.put("/{template_id}", response_model=EmailTemplateResponse)
def update_template(
    template_id: int,
    payload: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tmpl, field, value)
    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.delete("/{template_id}", status_code=200)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
        )
    # Check if template is assigned to any event
    assigned = (
        db.query(EmailEventAssignment)
        .filter(EmailEventAssignment.template_id == template_id)
        .first()
    )
    if assigned:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "TEMPLATE_IN_USE",
                    "message": f"Template is assigned to event '{assigned.event_type}' and cannot be deleted",
                }
            },
        )
    db.delete(tmpl)
    db.commit()
    return {"status": "deleted"}
