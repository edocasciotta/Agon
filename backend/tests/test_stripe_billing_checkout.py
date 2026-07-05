"""Tests for Phase 3 Stripe billing endpoints.

POST /api/billing/checkout-session
POST /api/billing/webhook
"""

import os

os.environ["AGON_ENV"] = "test"

from unittest.mock import MagicMock, patch

import app.models  # noqa — registers all models with Base.metadata
import pytest
import stripe
from app.config import settings
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.payment import Payment
from app.models.stripe_checkout_session import StripeCheckoutSession

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sellable_mt(db_session):
    """A MembershipType that is sellable online."""
    mt = MembershipType(
        name="Drop-in Class",
        type="credit_pack",
        price=20.0,
        currency="EUR",
        credits_included=1,
        validity_days=30,
        is_active=True,
        sellable_online=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def non_sellable_mt(db_session):
    """A MembershipType that is NOT sellable online."""
    mt = MembershipType(
        name="Staff Pass",
        type="credit_pack",
        price=0.0,
        currency="EUR",
        credits_included=0,
        is_active=True,
        sellable_online=False,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture(autouse=True)
def stripe_secret_key():
    """Ensure STRIPE_SECRET_KEY is set for checkout tests; reset after."""
    original = settings.STRIPE_SECRET_KEY
    settings.STRIPE_SECRET_KEY = "sk_test_fake"
    yield
    settings.STRIPE_SECRET_KEY = original


@pytest.fixture(autouse=True)
def stripe_webhook_secret():
    """Use a real-looking webhook secret so the webhook endpoint does not short-circuit."""
    original = settings.STRIPE_WEBHOOK_SECRET
    settings.STRIPE_WEBHOOK_SECRET = "whsec_real_for_test"
    yield
    settings.STRIPE_WEBHOOK_SECRET = original


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_stripe_session(
    session_id: str = "cs_test_001", url: str = "https://checkout.stripe.com/pay/test"
):
    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.url = url
    return mock_session


def _make_stripe_customer(customer_id: str = "cus_test_001"):
    mock_cust = MagicMock()
    mock_cust.id = customer_id
    return mock_cust


def _make_stripe_product(product_id: str = "prod_test_001"):
    mock_prod = MagicMock()
    mock_prod.id = product_id
    return mock_prod


def _make_stripe_price(price_id: str = "price_test_001"):
    mock_price = MagicMock()
    mock_price.id = price_id
    return mock_price


def _checkout_payload(client_id: int, mt_id: int) -> dict:
    return {
        "client_id": client_id,
        "membership_type_id": mt_id,
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
    }


def _fake_event(
    event_id: str,
    event_type: str,
    session_id: str,
    client_id: int,
    mt_id: int,
) -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": session_id,
                "payment_intent": "pi_test_001",
                "metadata": {
                    "client_id": str(client_id),
                    "membership_type_id": str(mt_id),
                    "agon_mode": "payment",
                },
            }
        },
    }


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — happy path
# ---------------------------------------------------------------------------


def test_checkout_session_payment_success(
    client, manager_auth_headers, db_session, registered_client, sellable_mt
):
    """Manager initiates checkout for a client → 200, checkout_url returned, row in DB."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    mock_cust = _make_stripe_customer()
    mock_prod = _make_stripe_product()
    mock_price = _make_stripe_price()
    mock_session = _make_stripe_session()

    with (
        patch("stripe.Customer.create", return_value=mock_cust) as mock_cust_create,
        patch("stripe.Product.create", return_value=mock_prod) as mock_prod_create,
        patch("stripe.Price.create", return_value=mock_price) as mock_price_create,
        patch("stripe.checkout.Session.create", return_value=mock_session) as mock_sess_create,
    ):

        resp = client.post(
            "/api/billing/checkout-session",
            json=_checkout_payload(client_obj.id, sellable_mt.id),
            headers=manager_auth_headers,
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["checkout_url"] == mock_session.url
    assert data["session_id"] == mock_session.id

    # StripeCheckoutSession row must exist
    cs = (
        db_session.query(StripeCheckoutSession).filter_by(stripe_session_id=mock_session.id).first()
    )
    assert cs is not None
    assert cs.mode == "payment"
    assert cs.status == "open"
    assert cs.client_id == client_obj.id

    # Stripe SDK called correctly
    mock_cust_create.assert_called_once()
    mock_prod_create.assert_called_once_with(name=sellable_mt.name)
    mock_price_create.assert_called_once()
    mock_sess_create.assert_called_once()


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — not sellable online
# ---------------------------------------------------------------------------


def test_checkout_session_not_sellable_online(
    client, manager_auth_headers, db_session, registered_client, non_sellable_mt
):
    """sellable_online=False → 400 MEMBERSHIP_TYPE_NOT_ONLINE."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    resp = client.post(
        "/api/billing/checkout-session",
        json=_checkout_payload(client_obj.id, non_sellable_mt.id),
        headers=manager_auth_headers,
    )

    assert resp.status_code == 400, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "MEMBERSHIP_TYPE_NOT_ONLINE"


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — Stripe not configured
# ---------------------------------------------------------------------------


def test_checkout_session_stripe_not_configured(
    client, manager_auth_headers, db_session, registered_client, sellable_mt
):
    """Empty STRIPE_SECRET_KEY → 503 STRIPE_NOT_CONFIGURED."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Override the autouse fixture for this test only
    settings.STRIPE_SECRET_KEY = ""
    try:
        resp = client.post(
            "/api/billing/checkout-session",
            json=_checkout_payload(client_obj.id, sellable_mt.id),
            headers=manager_auth_headers,
        )
    finally:
        settings.STRIPE_SECRET_KEY = "sk_test_fake"

    assert resp.status_code == 503, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "STRIPE_NOT_CONFIGURED"


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — client not found
# ---------------------------------------------------------------------------


def test_checkout_session_client_not_found(client, manager_auth_headers, db_session, sellable_mt):
    """Non-existent client_id → 404 CLIENT_NOT_FOUND."""
    resp = client.post(
        "/api/billing/checkout-session",
        json=_checkout_payload(99999, sellable_mt.id),
        headers=manager_auth_headers,
    )

    assert resp.status_code == 404, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "CLIENT_NOT_FOUND"


# ---------------------------------------------------------------------------
# POST /api/billing/webhook — checkout.session.completed grants membership
# ---------------------------------------------------------------------------


def test_webhook_checkout_completed_grants_membership(
    client, db_session, registered_client, sellable_mt
):
    """Webhook checkout.session.completed → Membership + Payment rows created."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    session_id = "cs_wh_test_001"

    # Pre-create a StripeCheckoutSession row (as the checkout endpoint would have)
    cs = StripeCheckoutSession(
        client_id=client_obj.id,
        stripe_session_id=session_id,
        membership_type_id=sellable_mt.id,
        mode="payment",
        status="open",
    )
    db_session.add(cs)
    db_session.commit()

    fake_event = _fake_event(
        "evt_test_001", "checkout.session.completed", session_id, client_obj.id, sellable_mt.id
    )

    with patch(
        "stripe.Webhook.construct_event",
        return_value=fake_event,
    ):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ok"

    db_session.expire_all()

    # Checkout session marked complete
    cs_refreshed = (
        db_session.query(StripeCheckoutSession).filter_by(stripe_session_id=session_id).first()
    )
    assert cs_refreshed.status == "complete"

    # Membership created
    membership = db_session.query(Membership).filter_by(client_id=client_obj.id).first()
    assert membership is not None
    assert membership.status == "active"
    assert membership.credits_remaining == sellable_mt.credits_included

    # Payment created
    payment = db_session.query(Payment).filter_by(client_id=client_obj.id).first()
    assert payment is not None
    assert payment.status == "completed"
    assert payment.provider == "stripe"
    assert payment.membership_id == membership.id


# ---------------------------------------------------------------------------
# POST /api/billing/webhook — idempotency
# ---------------------------------------------------------------------------


def test_webhook_idempotency(client, db_session, registered_client, sellable_mt):
    """Sending the same event twice returns already_processed and creates only one Membership."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    session_id = "cs_wh_idem_001"

    cs = StripeCheckoutSession(
        client_id=client_obj.id,
        stripe_session_id=session_id,
        membership_type_id=sellable_mt.id,
        mode="payment",
        status="open",
    )
    db_session.add(cs)
    db_session.commit()

    fake_event = _fake_event(
        "evt_idem_001", "checkout.session.completed", session_id, client_obj.id, sellable_mt.id
    )

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp1 = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )
        resp2 = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp1.status_code == 200
    assert resp1.json()["status"] == "ok"
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "already_processed"

    # Only one Membership row
    memberships = db_session.query(Membership).filter_by(client_id=client_obj.id).all()
    assert len(memberships) == 1


# ---------------------------------------------------------------------------
# POST /api/billing/webhook — invalid signature
# ---------------------------------------------------------------------------


def test_webhook_invalid_signature(client):
    """Invalid Stripe signature → 400 STRIPE_INVALID_SIGNATURE."""
    sig_err = stripe.error.SignatureVerificationError(
        "No signatures found matching the expected signature for payload",
        sig_header="t=1,v1=bad",
    )

    with patch("stripe.Webhook.construct_event", side_effect=sig_err):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=bad"},
        )

    assert resp.status_code == 400, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "STRIPE_INVALID_SIGNATURE"
