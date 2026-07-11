"""Waivers / digital signatures — /api/v1/waivers, /api/v1/clients/{client_id}/waivers

A manager authors waiver documents (e.g. "Liability Waiver"). Each can
optionally be marked `requires_before_booking`, in which case a client must
digitally sign the *current version* before booking (enforced in
app/services/booking_service.py::get_unsigned_required_waivers, wired into
app/routers/bookings.py::create_booking).

Signing is a typed full name + explicit consent — the same typed-name
e-signature (name, timestamp, IP) pattern already used by this codebase's
GDPR consent log (app/models/consent_log.py), not a drawn signature.

Manager CRUD mirrors app/routers/email_templates.py; the soft-delete mirrors
app/routers/promo_codes.py::deactivate_promo_code exactly (unlike email/SMS
templates, a waiver is deactivatable even with signature history — the
history itself is the point of the audit trail, so we never block on
TEMPLATE_IN_USE here). Client-facing endpoints mirror the self-or-staff
pattern in app/routers/calendar_sync.py / app/routers/tags.py.
"""

from typing import List

from app.auth import decode_token, get_current_client, oauth2_scheme, require_manager
from app.database import get_db
from app.models.client import Client
from app.models.waiver import Waiver
from app.models.waiver_signature import WaiverSignature
from app.schemas.waiver import (
    WaiverCreate,
    WaiverResponse,
    WaiverSignatureResponse,
    WaiverSignRequest,
    WaiverUpdate,
    WaiverWithStatus,
)
from app.utils import raise_api_error, utcnow
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["waivers"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_caller(token: str) -> tuple[str, int]:
    """Decode an access token and return (role, subject_id).

    Mirrors app/routers/tags.py::_resolve_caller / app/routers/calendar_sync.py —
    the established pattern for mixed client/manager endpoints in this codebase.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type.", status_code=401)
    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise_api_error("AUTH_TOKEN_INVALID", "Token missing subject.", status_code=401)
    return role, int(sub)


def _require_self_or_staff(role: str, subject_id: int, target_client_id: int) -> None:
    """Reject a client caller whose subject id is not the target client_id.

    Managers/instructors may act on any client (see docs/SECURITY_GUIDELINES.md §2).
    """
    if role not in ("manager", "instructor"):
        if subject_id != target_client_id:
            raise_api_error("FORBIDDEN", "You may only act on your own account.", status_code=403)


def _get_active_waiver_or_404(db: Session, waiver_id: int) -> Waiver:
    waiver = db.query(Waiver).filter(Waiver.id == waiver_id, Waiver.is_active.is_(True)).first()
    if waiver is None:
        raise_api_error("WAIVER_NOT_FOUND", "Waiver not found.", status_code=404)
    return waiver


# ---------------------------------------------------------------------------
# POST /api/v1/waivers  (manager-only)
# ---------------------------------------------------------------------------


@router.post("/waivers", response_model=WaiverResponse, status_code=201)
def create_waiver(
    payload: WaiverCreate,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Create a new waiver. Manager-only. Always starts at version=1."""
    waiver = Waiver(
        title=payload.title,
        body=payload.body,
        version=1,
        requires_before_booking=payload.requires_before_booking,
    )
    db.add(waiver)
    db.commit()
    db.refresh(waiver)
    return waiver


# ---------------------------------------------------------------------------
# GET /api/v1/waivers  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/waivers", response_model=List[WaiverResponse])
def list_waivers(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """List all waivers. Manager-only."""
    query = db.query(Waiver)
    if active_only:
        query = query.filter(Waiver.is_active.is_(True))
    return query.order_by(Waiver.id).all()


# ---------------------------------------------------------------------------
# GET /api/v1/waivers/{waiver_id}  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/waivers/{waiver_id}", response_model=WaiverResponse)
def get_waiver(
    waiver_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Get a waiver by ID. Manager-only."""
    waiver = db.query(Waiver).filter(Waiver.id == waiver_id).first()
    if not waiver:
        raise_api_error("WAIVER_NOT_FOUND", "Waiver not found.", status_code=404)
    return waiver


# ---------------------------------------------------------------------------
# PUT /api/v1/waivers/{waiver_id}  (manager-only)
# ---------------------------------------------------------------------------


@router.put("/waivers/{waiver_id}", response_model=WaiverResponse)
def update_waiver(
    waiver_id: int,
    payload: WaiverUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Update a waiver. Manager-only.

    If `body` is present in the payload and differs from the current value,
    `version` is incremented. title-only or requires_before_booking-only
    updates do NOT bump version.
    """
    waiver = db.query(Waiver).filter(Waiver.id == waiver_id).first()
    if not waiver:
        raise_api_error("WAIVER_NOT_FOUND", "Waiver not found.", status_code=404)

    data = payload.model_dump(exclude_unset=True)

    if "body" in data and data["body"] != waiver.body:
        waiver.version += 1

    for field, value in data.items():
        setattr(waiver, field, value)

    db.commit()
    db.refresh(waiver)
    return waiver


# ---------------------------------------------------------------------------
# DELETE /api/v1/waivers/{waiver_id}  (manager-only, soft-delete)
# ---------------------------------------------------------------------------


@router.delete("/waivers/{waiver_id}", response_model=WaiverResponse)
def deactivate_waiver(
    waiver_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Deactivate a waiver (set is_active=False). Manager-only.

    Mirrors app/routers/promo_codes.py::deactivate_promo_code. Unlike
    email/SMS templates, this never blocks on existing signatures — the
    signature history is the whole point of the audit trail. Deactivating
    just means the waiver stops being enforced/offered going forward.
    """
    waiver = db.query(Waiver).filter(Waiver.id == waiver_id).first()
    if not waiver:
        raise_api_error("WAIVER_NOT_FOUND", "Waiver not found.", status_code=404)

    waiver.is_active = False
    db.commit()
    db.refresh(waiver)
    return waiver


# ---------------------------------------------------------------------------
# GET /api/v1/clients/{client_id}/waivers  (client-self or manager)
# ---------------------------------------------------------------------------


@router.get("/clients/{client_id}/waivers", response_model=List[WaiverWithStatus])
def list_client_waivers(
    client_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """List active waivers with this client's signature status against the
    *current* version of each. IDOR-protected: a client may only view their
    own list; managers/instructors may view any client's.
    """
    role, subject_id = _resolve_caller(token)
    _require_self_or_staff(role, subject_id, client_id)

    client_obj = db.query(Client).filter(Client.id == client_id).first()
    if not client_obj:
        raise_api_error("NOT_FOUND", "Client not found.", status_code=404)

    waivers = db.query(Waiver).filter(Waiver.is_active.is_(True)).order_by(Waiver.id).all()

    results: List[WaiverWithStatus] = []
    for waiver in waivers:
        # Most recent signature overall (any version), for signed_at display.
        latest_signature = (
            db.query(WaiverSignature)
            .filter(
                WaiverSignature.waiver_id == waiver.id,
                WaiverSignature.client_id == client_id,
            )
            .order_by(WaiverSignature.signed_at.desc())
            .first()
        )
        # is_signed is true only if a signature exists at the CURRENT version —
        # signing an older version does not count after the waiver was edited.
        signed_current_version = (
            db.query(WaiverSignature)
            .filter(
                WaiverSignature.waiver_id == waiver.id,
                WaiverSignature.client_id == client_id,
                WaiverSignature.waiver_version == waiver.version,
            )
            .first()
            is not None
        )
        results.append(
            WaiverWithStatus(
                id=waiver.id,
                location_id=waiver.location_id,
                title=waiver.title,
                body=waiver.body,
                version=waiver.version,
                requires_before_booking=waiver.requires_before_booking,
                is_active=waiver.is_active,
                created_at=waiver.created_at,
                updated_at=waiver.updated_at,
                is_signed=signed_current_version,
                signed_at=latest_signature.signed_at if latest_signature else None,
            )
        )
    return results


# ---------------------------------------------------------------------------
# POST /api/v1/waivers/{waiver_id}/sign  (client-self only)
# ---------------------------------------------------------------------------


@router.post("/waivers/{waiver_id}/sign", response_model=WaiverSignatureResponse, status_code=201)
def sign_waiver(
    waiver_id: int,
    payload: WaiverSignRequest,
    request: Request,
    current_client=Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Record the caller's own digital signature for a waiver.

    Client-self only — get_current_client already rejects manager/instructor
    tokens with 403 AUTH_INSUFFICIENT_PERMISSIONS (see app/auth.py), since a
    manager must never sign on a client's behalf: the whole point is the
    client's own informed consent. Records waiver_version = the CURRENT
    version at signing time. Never deduplicated — re-signing after a version
    bump (or even the same version) always creates a new audit-trail row.
    """
    waiver = _get_active_waiver_or_404(db, waiver_id)

    signature = WaiverSignature(
        waiver_id=waiver.id,
        client_id=current_client.id,
        waiver_version=waiver.version,
        signed_name=payload.signed_name,
        signed_at=utcnow(),
        ip_address=request.client.host if request.client else None,
    )
    db.add(signature)
    db.commit()
    db.refresh(signature)
    return signature
