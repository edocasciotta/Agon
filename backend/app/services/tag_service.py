"""Tag service — auto-tag evaluation and tag assignment helpers.

Services never commit; the caller (router) owns the transaction.
"""

import json
import logging

from app.models.auto_tag_rule import AutoTagRule
from app.models.client_tag import ClientTag
from app.models.tag import Tag
from app.utils import utcnow
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def evaluate_auto_tags(
    db: Session,
    event_type: str,
    client_id: int,
    event_data: dict | None = None,
    location_id: int = 1,
) -> None:
    """Find all active auto-tag rules matching this event, then assign tags.

    For each matching rule:
    1. Check if condition_json matches event_data (if condition exists)
    2. If match, assign the tag to the client (skip if already assigned)

    Does NOT commit.
    """
    rules = (
        db.query(AutoTagRule)
        .filter(
            AutoTagRule.location_id == location_id,
            AutoTagRule.trigger_event == event_type,
            AutoTagRule.is_active.is_(True),
        )
        .all()
    )

    for rule in rules:
        if rule.condition_json:
            try:
                conditions = json.loads(rule.condition_json)
            except (json.JSONDecodeError, TypeError):
                continue

            if not _conditions_match(conditions, event_data or {}):
                continue

        assign_tag(db, client_id, rule.tag_id, assigned_by="auto")


def _conditions_match(conditions: dict, event_data: dict) -> bool:
    """Check if all key-value pairs in conditions are present in event_data."""
    for key, value in conditions.items():
        if str(event_data.get(key)) != str(value):
            return False
    return True


def assign_tag(
    db: Session,
    client_id: int,
    tag_id: int,
    assigned_by: str = "manual",
) -> ClientTag | None:
    """Assign a tag to a client. Skip silently if already assigned.

    Does NOT commit.
    """
    existing = (
        db.query(ClientTag)
        .filter(ClientTag.client_id == client_id, ClientTag.tag_id == tag_id)
        .first()
    )
    if existing:
        return existing

    # Verify tag exists
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        return None

    ct = ClientTag(
        client_id=client_id,
        tag_id=tag_id,
        location_id=tag.location_id,
        assigned_at=utcnow(),
        assigned_by=assigned_by,
    )
    db.add(ct)
    db.flush()
    return ct


def remove_tag(db: Session, client_id: int, tag_id: int) -> bool:
    """Remove a tag from a client. Returns True if removed, False if not found.

    Does NOT commit.
    """
    ct = (
        db.query(ClientTag)
        .filter(ClientTag.client_id == client_id, ClientTag.tag_id == tag_id)
        .first()
    )
    if not ct:
        return False
    db.delete(ct)
    db.flush()
    return True
