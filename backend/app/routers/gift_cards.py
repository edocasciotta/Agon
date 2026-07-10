"""Gift Cards router — manual issuance, CRUD, validation, and Stripe self-purchase."""

import stripe
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import decode_token, oauth2_scheme, require_manager
from app.config import settings
from app.database import get_db
from app.models.client import Client
from app.models.gift_card import GiftCard
from app.models.stripe_customer import StripeCustomer
from app.schemas.gift_card import (
    GiftCardIssueRequest,
    GiftCardPurchaseRequest,
    GiftCardResponse,
    GiftCardValidateRequest,
    GiftCardValidateResponse,
)
from app.services.gift_card_service import generate_gift_card_code, validate_gift_card
from app.utils import raise_api_error

router = APIRouter(prefix="/api/v1", tags=["gift-cards"])


# ---------------------------------------------------------------------------
# POST /api/v1/gift-cards  (manager-only)
# ---------------------------------------------------------------------------


@router.post("/gift-cards", response_model=GiftCardResponse, status_code=201)
def issue_gift_card(
    payload: GiftCardIssueRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Manually issue a gift card (e.g. for phone/in-person sales). Manager-only."""
    code = generate_gift_card_code(db)

    gift_card = GiftCard(
        code=code,
        initial_value=payload.initial_value,
        remaining_balance=payload.initial_value,
        purchaser_client_id=None,
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
        message=payload.message,
        expires_at=payload.expires_at,
    )
    db.add(gift_card)
    db.commit()
    db.refresh(gift_card)
    return gift_card


# ---------------------------------------------------------------------------
# GET /api/v1/gift-cards  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/gift-cards", response_model=list[GiftCardResponse])
def list_gift_cards(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """List all gift cards. Manager-only."""
    query = db.query(GiftCard)
    if active_only:
        query = query.filter(GiftCard.is_active.is_(True))
    return query.all()


# ---------------------------------------------------------------------------
# GET /api/v1/gift-cards/{gift_card_id}  (manager-only)
# ---------------------------------------------------------------------------


@router.get("/gift-cards/{gift_card_id}", response_model=GiftCardResponse)
def get_gift_card(
    gift_card_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Get a gift card by ID. Manager-only."""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()
    if not gift_card:
        raise_api_error("GIFT_CARD_NOT_FOUND", "Gift card not found.", status_code=404)
    return gift_card


# ---------------------------------------------------------------------------
# DELETE /api/v1/gift-cards/{gift_card_id}  (manager-only, soft-delete)
# ---------------------------------------------------------------------------


@router.delete("/gift-cards/{gift_card_id}", response_model=GiftCardResponse)
def deactivate_gift_card(
    gift_card_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(require_manager),
):
    """Deactivate a gift card (set is_active=False). Manager-only."""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()
    if not gift_card:
        raise_api_error("GIFT_CARD_NOT_FOUND", "Gift card not found.", status_code=404)

    gift_card.is_active = False
    db.commit()
    db.refresh(gift_card)
    return gift_card


# ---------------------------------------------------------------------------
# POST /api/v1/gift-cards/validate  (client + manager)
# ---------------------------------------------------------------------------


@router.post("/gift-cards/validate", response_model=GiftCardValidateResponse)
def validate_gift_card_endpoint(
    payload: GiftCardValidateRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Validate a gift card code and return its remaining balance.

    Does NOT redeem/deduct anything — read-only check.
    Accessible by authenticated clients and managers (codes are not
    client-scoped, so no ownership check is required beyond authentication).
    """
    decoded = decode_token(token)
    if decoded.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type.", status_code=401)

    gift_card = validate_gift_card(db, code=payload.code, location_id=1)

    return GiftCardValidateResponse(
        valid=True,
        remaining_balance=gift_card.remaining_balance,
        currency=gift_card.currency,
    )


# ---------------------------------------------------------------------------
# POST /api/v1/gift-cards/checkout-session  (client or manager)
# ---------------------------------------------------------------------------


@router.post("/gift-cards/checkout-session", status_code=200)
def create_gift_card_checkout_session(
    body: GiftCardPurchaseRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout Session for a client to purchase a gift card
    as a present for someone else.

    A client purchases using their own account (their JWT `sub` becomes
    `purchaser_client_id`). A manager purchasing does not have a membership
    of their own to attribute the purchase to, so `purchaser_client_id` is
    left null in that case.

    This is a separate, one-off (mode="payment") Checkout Session flow — it
    does not reuse or overload the membership checkout-session endpoint.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type", status_code=401)

    caller_role = payload.get("role", "client")
    purchaser_client_id: int | None = None

    if caller_role not in ("manager", "instructor"):
        purchaser_client_id = int(payload.get("sub"))
        purchaser = db.query(Client).filter(Client.id == purchaser_client_id).first()
        if not purchaser:
            raise_api_error("CLIENT_NOT_FOUND", "Client not found.", status_code=404)

    if not settings.STRIPE_SECRET_KEY:
        raise_api_error(
            "STRIPE_NOT_CONFIGURED",
            "Stripe is not configured for this studio.",
            status_code=503,
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        # Look up or create a StripeCustomer for a purchasing client. Managers
        # buying on behalf of no one have no client to attach a customer to,
        # so Stripe Checkout collects the email itself for that case.
        stripe_customer_id = None
        if purchaser_client_id is not None:
            stripe_customer_row = (
                db.query(StripeCustomer)
                .filter(StripeCustomer.client_id == purchaser_client_id)
                .first()
            )
            if stripe_customer_row is not None:
                stripe_customer_id = stripe_customer_row.stripe_customer_id
            else:
                stripe_cust = stripe.Customer.create(
                    email=purchaser.email,
                    name=purchaser.full_name,
                )
                stripe_customer_id = stripe_cust.id
                stripe_customer_row = StripeCustomer(
                    client_id=purchaser_client_id,
                    stripe_customer_id=stripe_customer_id,
                )
                db.add(stripe_customer_row)

        # No StripePrice caching for gift cards — the amount is arbitrary per
        # purchase, so create a fresh one-off Price every time.
        product = stripe.Product.create(name="Agon Gift Card")
        price = stripe.Price.create(
            unit_amount=int(body.amount * 100),
            currency="eur",
            product=product.id,
        )

        session_kwargs = {
            "line_items": [{"price": price.id, "quantity": 1}],
            "mode": "payment",
            "success_url": body.success_url,
            "cancel_url": body.cancel_url,
            "metadata": {
                "purchase_type": "gift_card",
                "purchaser_client_id": (
                    str(purchaser_client_id) if purchaser_client_id is not None else ""
                ),
                "amount": str(body.amount),
                "recipient_name": body.recipient_name or "",
                "recipient_email": body.recipient_email or "",
                "message": body.message or "",
            },
        }
        if stripe_customer_id is not None:
            session_kwargs["customer"] = stripe_customer_id
        # else: no known customer (manager purchase) — Stripe Checkout
        # collects the email itself.

        session = stripe.checkout.Session.create(**session_kwargs)

        db.commit()

    except stripe.error.StripeError:
        db.rollback()
        raise_api_error("STRIPE_API_ERROR", "A Stripe API error occurred.", status_code=502)

    return {"checkout_url": session.url, "session_id": session.id}
