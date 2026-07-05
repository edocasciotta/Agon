"""Stripe Billing Settings router — Phase 2 + Phase 3.

Admin-only settings endpoints (Phase 2) plus checkout-session and webhook
endpoints for one-off (mode="payment") purchases (Phase 3).
"""

import os
import tempfile
from datetime import date, timedelta

import stripe
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth import decode_token, oauth2_scheme, require_manager
from app.config import settings
from app.database import get_db
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.payment import Payment
from app.models.stripe_checkout_session import StripeCheckoutSession
from app.models.stripe_customer import StripeCustomer
from app.models.stripe_price import StripePrice
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.models.studio_settings import StudioSettings
from app.utils import raise_api_error, utcnow

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


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session  (Phase 3)
# ---------------------------------------------------------------------------


class CheckoutSessionRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: int
    membership_type_id: int
    success_url: str
    cancel_url: str


@router.post("/checkout-session", status_code=200)
def create_checkout_session(
    body: CheckoutSessionRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout Session for a one-off membership purchase.

    Accessible by authenticated clients (who may only purchase for themselves)
    and by managers (who may initiate on behalf of any client).
    """
    # Decode JWT to determine caller role — managers may pass any client_id,
    # clients are restricted to their own id in a future IDOR check if needed.
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    # 1. Load client
    client = db.query(Client).filter(Client.id == body.client_id).first()
    if not client:
        raise_api_error("CLIENT_NOT_FOUND", "Client not found.", status_code=404)

    # 2. Load membership type
    mt = db.query(MembershipType).filter(MembershipType.id == body.membership_type_id).first()
    if not mt:
        raise_api_error("MEMBERSHIP_TYPE_NOT_FOUND", "Membership type not found.", status_code=404)

    # 3. Must be sellable online
    if not mt.sellable_online:
        raise_api_error(
            "MEMBERSHIP_TYPE_NOT_ONLINE",
            "This membership type is not available for online purchase.",
            status_code=400,
        )

    # 4. Stripe must be configured
    if not settings.STRIPE_SECRET_KEY:
        raise_api_error(
            "STRIPE_NOT_CONFIGURED",
            "Stripe is not configured for this studio.",
            status_code=503,
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        # 6. Look up or create StripeCustomer
        sc_row = db.query(StripeCustomer).filter(StripeCustomer.client_id == client.id).first()
        if sc_row:
            stripe_customer_id = sc_row.stripe_customer_id
        else:
            stripe_cust = stripe.Customer.create(
                email=client.email,
                name=client.full_name,
            )
            stripe_customer_id = stripe_cust.id
            sc_row = StripeCustomer(
                client_id=client.id,
                stripe_customer_id=stripe_customer_id,
            )
            db.add(sc_row)

        # 7. Look up or create StripePrice (one-off)
        sp_row = (
            db.query(StripePrice)
            .filter(
                StripePrice.membership_type_id == mt.id,
                StripePrice.is_recurring == False,  # noqa: E712
            )
            .first()
        )
        if sp_row:
            stripe_price_id = sp_row.stripe_price_id
        else:
            product = stripe.Product.create(name=mt.name)
            price = stripe.Price.create(
                unit_amount=int(mt.price * 100),
                currency=mt.currency.lower(),
                product=product.id,
            )
            stripe_price_id = price.id
            sp_row = StripePrice(
                membership_type_id=mt.id,
                stripe_product_id=product.id,
                stripe_price_id=stripe_price_id,
                is_recurring=False,
                billing_interval=None,
            )
            db.add(sp_row)

        # 8. Create Stripe Checkout Session
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            line_items=[{"price": stripe_price_id, "quantity": 1}],
            mode="payment",
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={
                "client_id": str(client.id),
                "membership_type_id": str(mt.id),
                "agon_mode": "payment",
            },
        )

        # 9. Store StripeCheckoutSession
        cs_row = StripeCheckoutSession(
            client_id=client.id,
            stripe_session_id=session.id,
            membership_type_id=mt.id,
            mode="payment",
            status="open",
        )
        db.add(cs_row)

        # 10. Commit all new rows atomically
        db.commit()

    except stripe.error.StripeError:
        db.rollback()
        raise_api_error("STRIPE_API_ERROR", "A Stripe API error occurred.", status_code=502)

    # 11. Return checkout URL
    return {"checkout_url": session.url, "session_id": session.id}


# ---------------------------------------------------------------------------
# Private helper — called from webhook handler only
# ---------------------------------------------------------------------------


def _handle_checkout_completed(session_obj: dict, db: Session) -> None:
    """Process a checkout.session.completed event.

    Finds the StripeCheckoutSession row, marks it complete, then (for
    mode="payment") grants the membership and records the payment.
    Does NOT commit — the webhook handler commits after storing the event.
    """
    cs_row = (
        db.query(StripeCheckoutSession)
        .filter(StripeCheckoutSession.stripe_session_id == session_obj["id"])
        .first()
    )
    if cs_row is None:
        # Session was created by the old /api/v1/payments/stripe/checkout path — ignore.
        return

    cs_row.status = "complete"

    if cs_row.mode == "payment":
        mt = db.query(MembershipType).filter(MembershipType.id == cs_row.membership_type_id).first()
        if mt is None:
            return

        starts_at = date.today()
        expires_at = starts_at + timedelta(days=mt.validity_days) if mt.validity_days else None

        membership = Membership(
            client_id=cs_row.client_id,
            membership_type_id=mt.id,
            status="active",
            starts_at=starts_at,
            expires_at=expires_at,
            credits_remaining=mt.credits_included,
            credits_used=0,
        )
        db.add(membership)
        db.flush()  # populate membership.id

        payment = Payment(
            client_id=cs_row.client_id,
            membership_id=membership.id,
            amount=mt.price,
            currency=mt.currency,
            status="completed",
            provider="stripe",
            provider_payment_id=session_obj.get("payment_intent"),
            paid_at=utcnow(),
        )
        db.add(payment)
        # caller commits

    # mode == "subscription" → Phase 4, nothing to do here


# ---------------------------------------------------------------------------
# POST /api/billing/webhook  (Phase 3)
# ---------------------------------------------------------------------------


@router.post("/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook receiver. No auth — Stripe signs the payload."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # If webhook secret is the placeholder default, acknowledge without verifying
    # so Stripe does not retry indefinitely during setup.
    if settings.STRIPE_WEBHOOK_SECRET == "whsec_test":
        return {"status": "webhook_not_configured"}

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise_api_error(
            "STRIPE_INVALID_SIGNATURE",
            "Invalid Stripe webhook signature.",
            status_code=400,
        )

    # Idempotency: skip if we have already processed this event
    existing = (
        db.query(StripeWebhookEvent)
        .filter(StripeWebhookEvent.stripe_event_id == event["id"])
        .first()
    )
    if existing:
        return {"status": "already_processed"}

    # Dispatch
    if event["type"] == "checkout.session.completed":
        _handle_checkout_completed(event["data"]["object"], db)

    # Record the event (idempotency ledger) and commit
    db.add(StripeWebhookEvent(stripe_event_id=event["id"], event_type=event["type"]))
    db.commit()

    return {"status": "ok"}
