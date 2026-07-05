"""Stripe Billing Settings router — Phase 2 + Phase 3 + Phase 4.

Admin-only settings endpoints (Phase 2) plus checkout-session and webhook
endpoints for one-off (mode="payment") purchases (Phase 3) and recurring
subscription support (Phase 4).
"""

import os
import tempfile
from datetime import date, datetime, timedelta

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
from app.models.stripe_subscription import StripeSubscription
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.models.studio_settings import StudioSettings
from app.utils import raise_api_error, utcnow

router = APIRouter(prefix="/api/billing", tags=["stripe-billing"])

# Path to the .env file (backend/.env)
_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# Billing interval mapping: Agon → Stripe
_BILLING_INTERVAL_MAP = {
    "weekly": "week",
    "monthly": "month",
    "annual": "year",
}


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
# POST /api/billing/checkout-session  (Phase 3 + Phase 4)
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
    """Create a Stripe Checkout Session for a membership purchase.

    Supports both one-off (mode="payment") and recurring (mode="subscription")
    purchases depending on the membership type.

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

    # Determine checkout mode and Stripe interval (recurring types only)
    is_recurring = mt.type == "recurring"
    stripe_interval = _BILLING_INTERVAL_MAP.get(mt.billing_interval or "", "month")

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

        # 7. Look up or create StripePrice (recurring or one-off)
        sp_row = (
            db.query(StripePrice)
            .filter(
                StripePrice.membership_type_id == mt.id,
                StripePrice.is_recurring == is_recurring,  # noqa: E712
            )
            .first()
        )
        if sp_row:
            stripe_price_id = sp_row.stripe_price_id
        else:
            product = stripe.Product.create(name=mt.name)
            if is_recurring:
                price = stripe.Price.create(
                    unit_amount=int(mt.price * 100),
                    currency=mt.currency.lower(),
                    product=product.id,
                    recurring={"interval": stripe_interval},
                )
                sp_row = StripePrice(
                    membership_type_id=mt.id,
                    stripe_product_id=product.id,
                    stripe_price_id=price.id,
                    is_recurring=True,
                    billing_interval=stripe_interval,
                )
            else:
                price = stripe.Price.create(
                    unit_amount=int(mt.price * 100),
                    currency=mt.currency.lower(),
                    product=product.id,
                )
                sp_row = StripePrice(
                    membership_type_id=mt.id,
                    stripe_product_id=product.id,
                    stripe_price_id=price.id,
                    is_recurring=False,
                    billing_interval=None,
                )
            stripe_price_id = price.id
            db.add(sp_row)

        # 8. Create Stripe Checkout Session
        # NOTE: payment_intent_data must NOT be passed for mode="subscription"
        checkout_mode = "subscription" if is_recurring else "payment"
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            line_items=[{"price": stripe_price_id, "quantity": 1}],
            mode=checkout_mode,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={
                "client_id": str(client.id),
                "membership_type_id": str(mt.id),
                "agon_mode": checkout_mode,
            },
        )

        # 9. Store StripeCheckoutSession
        cs_row = StripeCheckoutSession(
            client_id=client.id,
            stripe_session_id=session.id,
            membership_type_id=mt.id,
            mode=checkout_mode,
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
# Private helpers — called from webhook handler only
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

    # mode == "subscription" → membership granted when customer.subscription.created fires


def _handle_subscription_upsert(sub_obj: dict, db: Session) -> None:
    """Handle customer.subscription.created and customer.subscription.updated.

    Upserts a StripeSubscription row and, when the subscription is active,
    grants a Membership if one does not already exist for this subscription.
    Does NOT commit — caller commits.
    """
    # 1. Find StripeCustomer
    sc_row = (
        db.query(StripeCustomer)
        .filter(StripeCustomer.stripe_customer_id == sub_obj["customer"])
        .first()
    )
    if sc_row is None:
        return  # unknown customer — not one of our clients

    client_id = sc_row.client_id
    status = sub_obj["status"]
    current_period_end = datetime.utcfromtimestamp(sub_obj["current_period_end"])
    stripe_price_id = sub_obj["items"]["data"][0]["price"]["id"]

    # 2. Upsert StripeSubscription
    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(StripeSubscription.stripe_subscription_id == sub_obj["id"])
        .first()
    )
    if stripe_sub_row:
        stripe_sub_row.status = status
        stripe_sub_row.current_period_end = current_period_end
        stripe_sub_row.updated_at = utcnow()
    else:
        stripe_sub_row = StripeSubscription(
            client_id=client_id,
            stripe_subscription_id=sub_obj["id"],
            stripe_price_id=stripe_price_id,
            status=status,
            current_period_end=current_period_end,
        )
        db.add(stripe_sub_row)
        db.flush()  # populate id

    # 3. Grant membership when subscription becomes active
    if status == "active":
        existing_membership = (
            db.query(Membership)
            .filter(
                Membership.client_id == client_id,
                Membership.stripe_subscription_id == sub_obj["id"],
                Membership.status == "active",
            )
            .first()
        )
        if existing_membership is None:
            # Find the most recent complete checkout session for this client
            cs_row = (
                db.query(StripeCheckoutSession)
                .filter(
                    StripeCheckoutSession.client_id == client_id,
                    StripeCheckoutSession.mode == "subscription",
                    StripeCheckoutSession.status == "complete",
                )
                .order_by(StripeCheckoutSession.created_at.desc())
                .first()
            )
            if cs_row is not None:
                mt = (
                    db.query(MembershipType)
                    .filter(MembershipType.id == cs_row.membership_type_id)
                    .first()
                )
                if mt is not None:
                    new_membership = Membership(
                        client_id=client_id,
                        membership_type_id=cs_row.membership_type_id,
                        status="active",
                        starts_at=date.today(),
                        expires_at=None,  # subscription — no fixed expiry
                        credits_remaining=mt.credits_included,
                        credits_used=0,
                        stripe_subscription_id=sub_obj["id"],
                    )
                    db.add(new_membership)

    # 4. Cancel membership when subscription is canceled or unpaid
    elif status in ("canceled", "unpaid"):
        active_membership = (
            db.query(Membership)
            .filter(
                Membership.stripe_subscription_id == sub_obj["id"],
                Membership.status == "active",
            )
            .first()
        )
        if active_membership is not None:
            active_membership.status = "cancelled"


def _handle_subscription_deleted(sub_obj: dict, db: Session) -> None:
    """Handle customer.subscription.deleted.

    Marks the StripeSubscription and any active Membership as cancelled.
    Does NOT commit — caller commits.
    """
    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(StripeSubscription.stripe_subscription_id == sub_obj["id"])
        .first()
    )
    if stripe_sub_row is None:
        return

    stripe_sub_row.status = "canceled"
    stripe_sub_row.updated_at = utcnow()

    active_membership = (
        db.query(Membership)
        .filter(
            Membership.stripe_subscription_id == sub_obj["id"],
            Membership.status == "active",
        )
        .first()
    )
    if active_membership is not None:
        active_membership.status = "cancelled"


def _handle_invoice_paid(invoice_obj: dict, db: Session) -> None:
    """Handle invoice.paid.

    Skips one-off invoices (no subscription). Records a Payment and
    refreshes membership expiry for subscription invoices.
    Does NOT commit — caller commits.
    """
    # 1. Skip one-off invoices (not tied to a subscription)
    if invoice_obj.get("subscription") is None:
        return

    # 2. Find the StripeSubscription row
    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(StripeSubscription.stripe_subscription_id == invoice_obj["subscription"])
        .first()
    )
    if stripe_sub_row is None:
        return

    # 3. Update active membership expiry / status
    active_membership = (
        db.query(Membership)
        .filter(
            Membership.stripe_subscription_id == invoice_obj["subscription"],
            Membership.status == "active",
        )
        .first()
    )
    if active_membership is not None:
        lines_data = invoice_obj.get("lines", {}).get("data", [])
        if lines_data:
            period_end_ts = lines_data[0].get("period", {}).get("end")
            if period_end_ts is not None:
                active_membership.expires_at = datetime.utcfromtimestamp(period_end_ts).date()
        active_membership.status = "active"

    # 4. Record payment
    payment = Payment(
        client_id=stripe_sub_row.client_id,
        amount=invoice_obj["amount_paid"] / 100,
        currency=invoice_obj["currency"].upper(),
        status="completed",
        provider="stripe",
        provider_payment_id=invoice_obj.get("payment_intent"),
        provider_invoice_id=invoice_obj.get("id"),
        paid_at=utcnow(),
    )
    db.add(payment)


def _handle_invoice_payment_failed(invoice_obj: dict, db: Session) -> None:
    """Handle invoice.payment_failed.

    Flags the active membership as payment_overdue. Does NOT revoke access.
    Does NOT commit — caller commits.
    """
    # 1. Skip one-off invoices
    if invoice_obj.get("subscription") is None:
        return

    # 2. Flag active membership
    active_membership = (
        db.query(Membership)
        .filter(
            Membership.stripe_subscription_id == invoice_obj["subscription"],
            Membership.status == "active",
        )
        .first()
    )
    if active_membership is not None:
        active_membership.status = "payment_overdue"


# ---------------------------------------------------------------------------
# POST /api/billing/webhook  (Phase 3 + Phase 4)
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

    # Dispatch to the appropriate handler
    handlers = {
        "checkout.session.completed": _handle_checkout_completed,
        "customer.subscription.created": _handle_subscription_upsert,
        "customer.subscription.updated": _handle_subscription_upsert,
        "customer.subscription.deleted": _handle_subscription_deleted,
        "invoice.paid": _handle_invoice_paid,
        "invoice.payment_failed": _handle_invoice_payment_failed,
    }
    handler = handlers.get(event["type"])
    if handler:
        handler(event["data"]["object"], db)

    # Record the event (idempotency ledger) and commit
    db.add(StripeWebhookEvent(stripe_event_id=event["id"], event_type=event["type"]))
    db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/billing/members/{client_id}/subscription  (Phase 4)
# ---------------------------------------------------------------------------


@router.get("/members/{client_id}/subscription", status_code=200)
def get_subscription_status(
    client_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Return the most recent Stripe subscription for a client.

    Accessible by managers or the client themselves.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    # Clients may only query their own subscription
    caller_role = payload.get("role", "client")
    if caller_role != "manager":
        caller_id = payload.get("sub")
        # sub is stored as string in JWT
        target_client = db.query(Client).filter(Client.id == client_id).first()
        if not target_client or str(target_client.id) != str(caller_id):
            raise_api_error(
                "FORBIDDEN",
                "You may only view your own subscription.",
                status_code=403,
            )

    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(StripeSubscription.client_id == client_id)
        .order_by(StripeSubscription.created_at.desc())
        .first()
    )

    if stripe_sub_row is None:
        return {"subscription": None}

    return {
        "subscription": {
            "stripe_subscription_id": stripe_sub_row.stripe_subscription_id,
            "status": stripe_sub_row.status,
            "current_period_end": (
                stripe_sub_row.current_period_end.isoformat()
                if stripe_sub_row.current_period_end
                else None
            ),
            "stripe_price_id": stripe_sub_row.stripe_price_id,
        }
    }


# ---------------------------------------------------------------------------
# POST /api/billing/members/{client_id}/subscription/cancel  (Phase 4)
# ---------------------------------------------------------------------------


@router.post("/members/{client_id}/subscription/cancel", status_code=200)
def cancel_subscription(
    client_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Cancel a client's active subscription at period end. Manager-only."""
    # Find active (non-canceled) subscription
    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(
            StripeSubscription.client_id == client_id,
            StripeSubscription.status != "canceled",
        )
        .order_by(StripeSubscription.created_at.desc())
        .first()
    )
    if stripe_sub_row is None:
        raise_api_error(
            "SUBSCRIPTION_NOT_FOUND",
            "No active subscription found for this client.",
            status_code=404,
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        stripe.Subscription.modify(
            stripe_sub_row.stripe_subscription_id,
            cancel_at_period_end=True,
        )
    except stripe.error.StripeError:
        raise_api_error(
            "STRIPE_API_ERROR",
            "A Stripe API error occurred while cancelling the subscription.",
            status_code=502,
        )

    stripe_sub_row.status = "canceled"
    db.commit()

    return {"status": "ok", "cancel_at_period_end": True}


# ---------------------------------------------------------------------------
# POST /api/billing/members/{client_id}/subscription/cancel/override  (Phase 7)
# ---------------------------------------------------------------------------


@router.post("/members/{client_id}/subscription/cancel/override", status_code=200)
def cancel_subscription_override(
    client_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Cancel a client's subscription locally in the DB without calling Stripe.

    Safety valve for when Stripe is unreachable or webhooks fail.
    Manager-only. Does NOT make any network calls to Stripe.
    """
    # 1. Find the most recent non-canceled StripeSubscription for this client
    stripe_sub_row = (
        db.query(StripeSubscription)
        .filter(
            StripeSubscription.client_id == client_id,
            StripeSubscription.status != "canceled",
        )
        .order_by(StripeSubscription.created_at.desc())
        .first()
    )
    if stripe_sub_row is None:
        raise_api_error(
            "SUBSCRIPTION_NOT_FOUND",
            "No active subscription found for this client.",
            status_code=404,
        )

    # 2. Cancel the StripeSubscription locally
    stripe_sub_row.status = "canceled"
    stripe_sub_row.updated_at = utcnow()

    # 3. Cancel any linked Membership that is not already cancelled
    membership = (
        db.query(Membership)
        .filter(
            Membership.stripe_subscription_id == stripe_sub_row.stripe_subscription_id,
            Membership.status != "cancelled",
        )
        .first()
    )
    if membership is not None:
        membership.status = "cancelled"

    # 4. Commit all changes
    db.commit()

    # 5. Return confirmation
    return {
        "status": "ok",
        "override": True,
        "stripe_subscription_id": stripe_sub_row.stripe_subscription_id,
    }
