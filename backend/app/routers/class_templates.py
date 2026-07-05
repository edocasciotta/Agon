from typing import List

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models.class_template import ClassTemplate
from app.schemas.class_template import (
    ClassTemplateCreate,
    ClassTemplateResponse,
    ClassTemplateUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/class-templates", tags=["class-templates"])


@router.get("", response_model=List[ClassTemplateResponse])
def list_templates(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(ClassTemplate)
    if not include_inactive:
        query = query.filter(ClassTemplate.is_active.is_(True))
    return query.all()


@router.post("", response_model=ClassTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: ClassTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    template = ClassTemplate(**payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=ClassTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    template = db.query(ClassTemplate).filter(ClassTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Class template not found"}},
        )
    return template


@router.put("/{template_id}", response_model=ClassTemplateResponse)
def update_template(
    template_id: int,
    payload: ClassTemplateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    template = db.query(ClassTemplate).filter(ClassTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Class template not found"}},
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", response_model=ClassTemplateResponse)
def deactivate_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    template = db.query(ClassTemplate).filter(ClassTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Class template not found"}},
        )
    template.is_active = False
    db.commit()
    db.refresh(template)
    return template
