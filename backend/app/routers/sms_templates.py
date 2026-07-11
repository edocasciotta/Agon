"""
SMS Templates CRUD — /api/v1/sms/templates
"""

from typing import List

from app.auth import require_manager
from app.database import get_db
from app.models.sms_event_assignment import SmsEventAssignment
from app.models.sms_template import SmsTemplate
from app.schemas.sms_template import (
    SmsTemplateCreate,
    SmsTemplateListItem,
    SmsTemplateResponse,
    SmsTemplateUpdate,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/sms/templates", tags=["sms-templates"])


@router.get("", response_model=List[SmsTemplateListItem])
def list_templates(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    return db.query(SmsTemplate).all()


@router.post("", response_model=SmsTemplateResponse, status_code=201)
def create_template(
    payload: SmsTemplateCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = SmsTemplate(
        name=payload.name,
        body=payload.body,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.get("/{template_id}", response_model=SmsTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = db.query(SmsTemplate).filter(SmsTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
        )
    return tmpl


@router.put("/{template_id}", response_model=SmsTemplateResponse)
def update_template(
    template_id: int,
    payload: SmsTemplateUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tmpl = db.query(SmsTemplate).filter(SmsTemplate.id == template_id).first()
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
    tmpl = db.query(SmsTemplate).filter(SmsTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Template not found"}},
        )
    # Check if template is assigned to any event
    assigned = (
        db.query(SmsEventAssignment).filter(SmsEventAssignment.template_id == template_id).first()
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
