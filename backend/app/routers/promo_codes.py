"""Promo Codes router — CRUD + validation for discount codes."""

import json
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import decode_token, oauth2_scheme, require_manager
from app.database import get_db
from app.models.promo_code import PromoCode
from app.schemas.promo_code import (
    PromoCodeCreate,
    PromoCodeResponse,
    PromoCodeUpdate,
    PromoCodeValidateRequest,
    PromoCodeValidateResponse,
)
from app.services.promo_code_service import validate_promo_code
from app.utils import raise_api_error

router = APIRouter(prefix="/api/v1", tags=["promo-codes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_applicable_ids(ids: Optional[list[int]]) -> Optional[str]:
    """Convert a list of ints to a JSON string for DB storage, or None."""
    if ids is None:
        return None
    return json.dumps(ids)


def _deserialize_applicable_ids(raw: Optional[str]) -> Optional[list[int]]:
    """Convert a JSON string back to a list of ints, or None."""
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def _promo_to_response(promo: PromoCode) -> dict:
    """Convert a PromoCode model to a response dict with deserialized applicable_ids."""
    return {
        "id": promo.id,
        "location_id": promo.location_id,
        "code": promo.code,
        "discount_type": promo.discount_type,
        "discount_value": promo.discount_value,
        "applicable_membership_type_ids": _deserialize_applicable_ids(
            promo.applicable_membership_type_ids
        ),
        "max_uses": promo.max_uses,
        "current_uses": promo.current_uses,
        "one_per_client": promo.one_per_client,
        "valid_from": promo.valid_from,
        "valid_until": promo.valid_until,
        "is_active": promo.is_active,
        "created_at": promo.created_at,
        "updated_at": promo.updated_at,
    }


# ---------------------------------------------------------------------------
# GET /api/v1/promo-codes  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/promo-codes", response_model=list[PromoCodeResponse])
def list_promo_codes(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """List all promo codes. Manager-only."""
    query = db.query(PromoCode)
    if active_only:
        query = query.filter(PromoCode.is_active.is_(True))
    promos = query.all()
    return [_promo_to_response(p) for p in promos]


# ---------------------------------------------------------------------------
# POST /api/v1/promo-codes  (manager-only)
# ---------------------------------------------------------------------------


@router.post("/promo-codes", response_model=PromoCodeResponse, status_code=201)
def create_promo_code(
    payload: PromoCodeCreate,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Create a new promo code. Manager-only."""
    # Check uniqueness
    existing = (
        db.query(PromoCode)
        .filter(PromoCode.location_id == 1, PromoCode.code == payload.code)
        .first()
    )
    if existing:
        raise_api_error(
            "PROMO_CODE_DUPLICATE",
            "A promo code with this code already exists.",
            status_code=409,
        )

    promo = PromoCode(
        code=payload.code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        applicable_membership_type_ids=_serialize_applicable_ids(
            payload.applicable_membership_type_ids
        ),
        max_uses=payload.max_uses,
        one_per_client=payload.one_per_client,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        is_active=payload.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return _promo_to_response(promo)


# ---------------------------------------------------------------------------
# GET /api/v1/promo-codes/{promo_code_id}  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/promo-codes/{promo_code_id}", response_model=PromoCodeResponse)
def get_promo_code(
    promo_code_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Get a promo code by ID. Manager-only."""
    promo = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()
    if not promo:
        raise_api_error("PROMO_CODE_NOT_FOUND", "Promo code not found.", status_code=404)
    return _promo_to_response(promo)


# ---------------------------------------------------------------------------
# PUT /api/v1/promo-codes/{promo_code_id}  (manager-only)
# ---------------------------------------------------------------------------


@router.put("/promo-codes/{promo_code_id}", response_model=PromoCodeResponse)
def update_promo_code(
    promo_code_id: int,
    payload: PromoCodeUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Update a promo code. Manager-only."""
    promo = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()
    if not promo:
        raise_api_error("PROMO_CODE_NOT_FOUND", "Promo code not found.", status_code=404)

    data = payload.model_dump(exclude_unset=True)

    # Handle applicable_membership_type_ids serialization
    if "applicable_membership_type_ids" in data:
        data["applicable_membership_type_ids"] = _serialize_applicable_ids(
            data["applicable_membership_type_ids"]
        )

    for field, value in data.items():
        setattr(promo, field, value)

    db.commit()
    db.refresh(promo)
    return _promo_to_response(promo)


# ---------------------------------------------------------------------------
# DELETE /api/v1/promo-codes/{promo_code_id}  (manager-only, soft-delete)
# ---------------------------------------------------------------------------


@router.delete("/promo-codes/{promo_code_id}", response_model=PromoCodeResponse)
def deactivate_promo_code(
    promo_code_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Deactivate a promo code (set is_active=False). Manager-only."""
    promo = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()
    if not promo:
        raise_api_error("PROMO_CODE_NOT_FOUND", "Promo code not found.", status_code=404)

    promo.is_active = False
    db.commit()
    db.refresh(promo)
    return _promo_to_response(promo)


# ---------------------------------------------------------------------------
# POST /api/v1/promo-codes/validate  (client + manager)
# ---------------------------------------------------------------------------


@router.post("/promo-codes/validate", response_model=PromoCodeValidateResponse)
def validate_promo_code_endpoint(
    payload: PromoCodeValidateRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Validate a promo code and return discount info. Does NOT record usage.

    Accessible by authenticated clients and managers.
    """
    decoded = decode_token(token)
    if decoded.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type.", status_code=401)

    caller_role = decoded.get("role", "client")
    caller_id = int(decoded.get("sub"))

    # For clients, validate against their own ID. For managers, use a dummy
    # client_id=0 since they are just previewing (one_per_client check won't
    # match any real usage).
    if caller_role == "client":
        client_id = caller_id
    else:
        client_id = caller_id  # managers also have an identity for the check

    from app.models.membership_type import MembershipType

    mt = db.query(MembershipType).filter(MembershipType.id == payload.membership_type_id).first()
    if mt is None:
        raise_api_error(
            "MEMBERSHIP_TYPE_NOT_FOUND",
            "Membership type not found.",
            status_code=404,
        )

    original_price = mt.price
    if mt.is_intro_offer and mt.intro_price is not None:
        original_price = mt.intro_price

    promo, discount_amount, final_price = validate_promo_code(
        db=db,
        code=payload.code,
        membership_type_id=payload.membership_type_id,
        client_id=client_id,
        location_id=1,
    )

    return PromoCodeValidateResponse(
        valid=True,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        discount_amount=discount_amount,
        original_price=original_price,
        final_price=final_price,
    )
