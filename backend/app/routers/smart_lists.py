"""
Smart Lists — /api/v1/smartlists
"""

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_manager
from app.database import get_db
from app.models.smart_list import SmartList
from app.schemas.smart_list import (
    SmartListCreate,
    SmartListListItem,
    SmartListUpdate,
)
from app.services import smart_list_service

router = APIRouter(prefix="/api/v1/smartlists", tags=["smart-lists"])


def _serialize(sl: SmartList) -> dict:
    return {
        "id": sl.id,
        "name": sl.name,
        "description": sl.description,
        "filters": json.loads(sl.filters) if sl.filters else {},
        "created_at": sl.created_at,
        "updated_at": sl.updated_at,
    }


@router.get("", response_model=List[SmartListListItem])
def list_smart_lists(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    return db.query(SmartList).all()


@router.post("", status_code=201)
def create_smart_list(
    payload: SmartListCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    filters_json = json.dumps(payload.filters or {})
    sl = SmartList(
        name=payload.name,
        description=payload.description,
        filters=filters_json,
    )
    db.add(sl)
    db.commit()
    db.refresh(sl)
    return _serialize(sl)


@router.get("/{list_id}")
def get_smart_list(
    list_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sl = db.query(SmartList).filter(SmartList.id == list_id).first()
    if not sl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Smart list not found"}},
        )
    return _serialize(sl)


@router.put("/{list_id}")
def update_smart_list(
    list_id: int,
    payload: SmartListUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sl = db.query(SmartList).filter(SmartList.id == list_id).first()
    if not sl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Smart list not found"}},
        )
    if payload.name is not None:
        sl.name = payload.name
    if payload.description is not None:
        sl.description = payload.description
    if payload.filters is not None:
        sl.filters = json.dumps(payload.filters)
    db.commit()
    db.refresh(sl)
    return _serialize(sl)


@router.delete("/{list_id}", status_code=200)
def delete_smart_list(
    list_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sl = db.query(SmartList).filter(SmartList.id == list_id).first()
    if not sl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Smart list not found"}},
        )
    db.delete(sl)
    db.commit()
    return {"status": "deleted"}


@router.get("/{list_id}/preview")
def preview_smart_list(
    list_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sl = db.query(SmartList).filter(SmartList.id == list_id).first()
    if not sl:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Smart list not found"}},
        )
    filters = json.loads(sl.filters) if sl.filters else {}
    clients = smart_list_service.apply_filters(db, filters)
    return {
        "count": len(clients),
        "clients": [{"id": c.id, "full_name": c.full_name, "email": c.email} for c in clients],
    }
