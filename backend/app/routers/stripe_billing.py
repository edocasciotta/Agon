"""Stripe Billing Settings router — Phase 2.

Admin-only endpoints to configure and query Stripe integration.
"""

import os
import tempfile

import stripe
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth import require_manager
from app.config import settings
from app.database import get_db
from app.models.studio_settings import StudioSettings
from app.utils import raise_api_error

router = APIRouter(prefix="/api/billing", tags=["stripe-billing"])

# Path to the .env file (backend/.env)
_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class StripeBillingSettingsRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    secret_key: str
    publishable_key: str
    webhook_secret: str | None = None  # optional — update only if provided


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _update_env_file(updates: dict[str, str]) -> None:
    """Atomically update (or add) key=value pairs in the .env file.

    Reads the existing file, replaces matching lines, appends any missing
    keys, then writes atomically via a temp file + os.replace.
    """
    env_path = _ENV_PATH
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    remaining = dict(updates)  # keys we still need to write
    new_lines: list[str] = []
    for line in lines:
        stripped = line.rstrip("\n")
        # Check if this line sets one of our target keys
        for key in list(remaining.keys()):
            if stripped.startswith(f"{key}=") or stripped == key:
                new_lines.append(f"{key}={remaining.pop(key)}\n")
                break
        else:
            new_lines.append(line)

    # Append keys that were not found in the existing file
    for key, value in remaining.items():
        new_lines.append(f"{key}={value}\n")

    # Atomic write: temp file alongside target, then replace
    dir_name = os.path.dirname(env_path)
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".env.tmp.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        os.replace(tmp_path, env_path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# POST /api/billing/settings
# ---------------------------------------------------------------------------


@router.post("/settings", status_code=200)
def post_billing_settings(
    body: StripeBillingSettingsRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Validate a Stripe secret key and persist all Stripe credentials."""

    # 1. Validate the secret key via the Stripe API
    try:
        account = stripe.Account.retrieve(api_key=body.secret_key)
    except stripe.error.AuthenticationError:
        raise_api_error(
            "STRIPE_KEY_INVALID",
            "The provided Stripe secret key failed authentication.",
            status_code=422,
        )
    except stripe.error.StripeError:
        raise_api_error(
            "STRIPE_API_ERROR",
            "A Stripe API error occurred while validating the key.",
            status_code=502,
        )

    # 2. Persist credentials to .env atomically
    env_updates: dict[str, str] = {
        "STRIPE_SECRET_KEY": body.secret_key,
        "STRIPE_PUBLISHABLE_KEY": body.publishable_key,
    }
    if body.webhook_secret is not None:
        env_updates["STRIPE_WEBHOOK_SECRET"] = body.webhook_secret
    _update_env_file(env_updates)

    # 3. Update the live settings object so subsequent in-process requests work
    settings.STRIPE_SECRET_KEY = body.secret_key
    settings.STRIPE_PUBLISHABLE_KEY = body.publishable_key
    if body.webhook_secret is not None:
        settings.STRIPE_WEBHOOK_SECRET = body.webhook_secret

    # 4. Update StudioSettings in the DB
    studio = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not studio:
        raise_api_error("STUDIO_NOT_FOUND", "Studio settings (id=1) not found.", status_code=404)

    studio.stripe_connected = True
    studio.stripe_account_id = account.id
    db.commit()

    return {"status": "ok", "stripe_account_id": account.id}


# ---------------------------------------------------------------------------
# GET /api/billing/settings
# ---------------------------------------------------------------------------


@router.get("/settings", status_code=200)
def get_billing_settings(
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Return current Stripe connection status. Never returns the secret key."""

    studio = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not studio:
        raise_api_error("STUDIO_NOT_FOUND", "Studio settings (id=1) not found.", status_code=404)

    return {
        "stripe_connected": studio.stripe_connected,
        "stripe_account_id": studio.stripe_account_id,
        "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
    }
