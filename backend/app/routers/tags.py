"""Tags — /api/v1/tags, /api/v1/clients/{client_id}/tags, /api/v1/auto-tag-rules"""

import json
from typing import List

from app.auth import decode_token, oauth2_scheme, require_manager
from app.database import get_db
from app.models.auto_tag_rule import AutoTagRule
from app.models.client import Client
from app.models.client_tag import ClientTag
from app.models.tag import Tag
from app.schemas.tag import (
    VALID_TRIGGER_EVENTS,
    AutoTagRuleCreate,
    AutoTagRuleResponse,
    AutoTagRuleUpdate,
    ClientTagAssign,
    ClientTagResponse,
    TagCreate,
    TagResponse,
    TagUpdate,
)
from app.services import tag_service
from app.utils import raise_api_error
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["tags"])


# ── Tag CRUD (manager-only) ─────────────────────────────────────────────────


@router.get("/tags", response_model=List[TagResponse])
def list_tags(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("/tags", response_model=TagResponse, status_code=201)
def create_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    existing = db.query(Tag).filter(Tag.name == payload.name).first()
    if existing:
        raise_api_error("TAG_DUPLICATE", "A tag with this name already exists.", status_code=409)

    tag = Tag(name=payload.name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.put("/tags/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    payload: TagUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Tag not found"}},
        )

    if payload.name is not None:
        dup = db.query(Tag).filter(Tag.name == payload.name, Tag.id != tag_id).first()
        if dup:
            raise_api_error(
                "TAG_DUPLICATE", "A tag with this name already exists.", status_code=409
            )
        tag.name = payload.name
    if payload.color is not None:
        tag.color = payload.color

    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=200)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Tag not found"}},
        )

    # Cascade: remove all client_tags and auto_tag_rules referencing this tag
    db.query(ClientTag).filter(ClientTag.tag_id == tag_id).delete()
    db.query(AutoTagRule).filter(AutoTagRule.tag_id == tag_id).delete()
    db.delete(tag)
    db.commit()
    return {"status": "deleted"}


# ── Client Tags ──────────────────────────────────────────────────────────────


def _resolve_caller(token: str):
    """Returns (role, subject_id) from token."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )
    return role, int(sub)


@router.get("/clients/{client_id}/tags", response_model=List[ClientTagResponse])
def list_client_tags(
    client_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)

    # Client can only see their own tags
    if role not in ("manager", "instructor"):
        if subject_id != client_id:
            raise_api_error("FORBIDDEN", "Access denied.", status_code=403)

    client_obj = db.query(Client).filter(Client.id == client_id).first()
    if not client_obj:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    rows = (
        db.query(ClientTag, Tag)
        .join(Tag, ClientTag.tag_id == Tag.id)
        .filter(ClientTag.client_id == client_id)
        .all()
    )

    return [
        ClientTagResponse(
            id=ct.id,
            client_id=ct.client_id,
            tag_id=ct.tag_id,
            tag_name=tag.name,
            tag_color=tag.color,
            assigned_at=ct.assigned_at,
            assigned_by=ct.assigned_by,
        )
        for ct, tag in rows
    ]


@router.post("/clients/{client_id}/tags", response_model=ClientTagResponse, status_code=201)
def assign_client_tag(
    client_id: int,
    payload: ClientTagAssign,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    client_obj = db.query(Client).filter(Client.id == client_id).first()
    if not client_obj:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    tag = db.query(Tag).filter(Tag.id == payload.tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Tag not found"}},
        )

    ct = tag_service.assign_tag(db, client_id, payload.tag_id, assigned_by="manual")
    db.commit()
    db.refresh(ct)

    return ClientTagResponse(
        id=ct.id,
        client_id=ct.client_id,
        tag_id=ct.tag_id,
        tag_name=tag.name,
        tag_color=tag.color,
        assigned_at=ct.assigned_at,
        assigned_by=ct.assigned_by,
    )


@router.delete("/clients/{client_id}/tags/{tag_id}", status_code=200)
def remove_client_tag(
    client_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    removed = tag_service.remove_tag(db, client_id, tag_id)
    if not removed:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Tag assignment not found"}},
        )
    db.commit()
    return {"status": "removed"}


# ── Auto-Tag Rules (manager-only) ───────────────────────────────────────────


@router.get("/auto-tag-rules", response_model=List[AutoTagRuleResponse])
def list_auto_tag_rules(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    return db.query(AutoTagRule).order_by(AutoTagRule.id).all()


@router.post("/auto-tag-rules", response_model=AutoTagRuleResponse, status_code=201)
def create_auto_tag_rule(
    payload: AutoTagRuleCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    if payload.trigger_event not in VALID_TRIGGER_EVENTS:
        raise_api_error(
            "INVALID_TRIGGER_EVENT",
            f"Invalid trigger event. Valid: {', '.join(sorted(VALID_TRIGGER_EVENTS))}",
            status_code=422,
        )

    tag = db.query(Tag).filter(Tag.id == payload.tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Tag not found"}},
        )

    condition_str = json.dumps(payload.condition_json) if payload.condition_json else None

    rule = AutoTagRule(
        tag_id=payload.tag_id,
        trigger_event=payload.trigger_event,
        condition_json=condition_str,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/auto-tag-rules/{rule_id}", response_model=AutoTagRuleResponse)
def update_auto_tag_rule(
    rule_id: int,
    payload: AutoTagRuleUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    rule = db.query(AutoTagRule).filter(AutoTagRule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Auto-tag rule not found"}},
        )

    data = payload.model_dump(exclude_unset=True)

    if "trigger_event" in data and data["trigger_event"] not in VALID_TRIGGER_EVENTS:
        raise_api_error(
            "INVALID_TRIGGER_EVENT",
            f"Invalid trigger event. Valid: {', '.join(sorted(VALID_TRIGGER_EVENTS))}",
            status_code=422,
        )

    if "tag_id" in data:
        tag = db.query(Tag).filter(Tag.id == data["tag_id"]).first()
        if not tag:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "Tag not found"}},
            )
        rule.tag_id = data["tag_id"]

    if "trigger_event" in data:
        rule.trigger_event = data["trigger_event"]
    if "condition_json" in data:
        rule.condition_json = json.dumps(data["condition_json"]) if data["condition_json"] else None
    if "is_active" in data:
        rule.is_active = data["is_active"]

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/auto-tag-rules/{rule_id}", status_code=200)
def delete_auto_tag_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    rule = db.query(AutoTagRule).filter(AutoTagRule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Auto-tag rule not found"}},
        )
    db.delete(rule)
    db.commit()
    return {"status": "deleted"}
