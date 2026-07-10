"""Tests for intro offer / trial membership feature.

Covers:
- Client purchases intro offer successfully (first time)
- Client tries to purchase intro offer again -> 409 INTRO_OFFER_ALREADY_USED
- Client purchases non-intro membership -> no restriction
- Manager assigns intro offer -> same one-per-client check
- Intro offer uses intro_price instead of regular price
- Two different locations: client can use intro at each location once
"""

import datetime
import os

os.environ["AGON_ENV"] = "test"

from unittest.mock import MagicMock, patch

import app.models  # noqa — registers all models with Base.metadata
import pytest
from app.config import settings
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.payment import Payment
from app.models.stripe_checkout_session import StripeCheckoutSession
from app.services.intro_offer_service import can_use_intro_offer

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def intro_offer_mt(db_session):
    """An intro offer MembershipType, sellable online."""
    mt = MembershipType(
        name="Intro Offer",
        type="credit_pack",
        price=100.0,
        currency="EUR",
        credits_included=5,
        validity_days=30,
        is_active=True,
        sellable_online=True,
        is_intro_offer=True,
        intro_price=19.99,
        intro_validity_days=14,
        location_id=1,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def intro_offer_mt_location2(db_session):
    """An intro offer MembershipType at location 2."""
    mt = MembershipType(
        name="Intro Offer Location 2",
        type="credit_pack",
        price=100.0,
        currency="EUR",
        credits_included=5,
        validity_days=30,
        is_active=True,
        sellable_online=True,
        is_intro_offer=True,
        intro_price=29.99,
        intro_validity_days=14,
        location_id=2,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def regular_mt(db_session):
    """A regular (non-intro) MembershipType, sellable online."""
    mt = MembershipType(
        name="Regular Pack",
        type="credit_pack",
        price=80.0,
        currency="EUR",
        credits_included=10,
        validity_days=30,
        is_active=True,
        sellable_online=True,
        is_intro_offer=False,
        location_id=1,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture(autouse=True)
def stripe_secret_key():
    original = settings.STRIPE_SECRET_KEY
    settings.STRIPE_SECRET_KEY = "sk_test_fake"
    yield
    settings.STRIPE_SECRET_KEY = original


@pytest.fixture(autouse=True)
def stripe_webhook_secret():
    original = settings.STRIPE_WEBHOOK_SECRET
    settings.STRIPE_WEBHOOK_SECRET = "whsec_real_for_test"
    yield
    settings.STRIPE_WEBHOOK_SECRET = original


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_stripe_mocks():
    mock_cust = MagicMock()
    mock_cust.id = "cus_intro_test"
    mock_prod = MagicMock()
    mock_prod.id = "prod_intro_test"
    mock_price = MagicMock()
    mock_price.id = "price_intro_test"
    mock_session = MagicMock()
    mock_session.id = "cs_intro_test"
    mock_session.url = "https://checkout.stripe.com/pay/intro"
    return mock_cust, mock_prod, mock_price, mock_session


def _checkout_payload(client_id: int, mt_id: int) -> dict:
    return {
        "client_id": client_id,
        "membership_type_id": mt_id,
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
    }


# ---------------------------------------------------------------------------
# Service unit tests
# ---------------------------------------------------------------------------


def test_can_use_intro_offer_first_time(db_session, intro_offer_mt, registered_client):
    """Client who has never used an intro offer -> True."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    assert can_use_intro_offer(db_session, client_obj.id, 1) is True


def test_can_use_intro_offer_already_used(db_session, intro_offer_mt, registered_client):
    """Client who already has an intro membership -> False."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Give client an existing intro membership
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=intro_offer_mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()

    assert can_use_intro_offer(db_session, client_obj.id, 1) is False


def test_can_use_intro_offer_different_location(
    db_session, intro_offer_mt, intro_offer_mt_location2, registered_client
):
    """Client used intro at location 1 but not at location 2 -> True for location 2."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Give client an existing intro membership at location 1
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=intro_offer_mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()

    assert can_use_intro_offer(db_session, client_obj.id, 1) is False
    assert can_use_intro_offer(db_session, client_obj.id, 2) is True


def test_can_use_intro_offer_expired_still_blocks(db_session, intro_offer_mt, registered_client):
    """Even expired intro memberships block re-use (one-per-client-per-location)."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    m = Membership(
        client_id=client_obj.id,
        membership_type_id=intro_offer_mt.id,
        status="expired",
        starts_at=datetime.date.today() - datetime.timedelta(days=60),
        expires_at=datetime.date.today() - datetime.timedelta(days=30),
        credits_remaining=0,
        credits_used=5,
    )
    db_session.add(m)
    db_session.commit()

    assert can_use_intro_offer(db_session, client_obj.id, 1) is False


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — intro offer happy path
# ---------------------------------------------------------------------------


def test_checkout_intro_offer_success(
    client, manager_auth_headers, db_session, registered_client, intro_offer_mt
):
    """First-time intro offer checkout -> 200, uses intro_price."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    mock_cust, mock_prod, mock_price, mock_session = _make_stripe_mocks()

    with (
        patch("stripe.Customer.create", return_value=mock_cust),
        patch("stripe.Product.create", return_value=mock_prod),
        patch("stripe.Price.create", return_value=mock_price) as mock_price_create,
        patch("stripe.checkout.Session.create", return_value=mock_session),
    ):
        resp = client.post(
            "/api/billing/checkout-session",
            json=_checkout_payload(client_obj.id, intro_offer_mt.id),
            headers=manager_auth_headers,
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["checkout_url"] == mock_session.url

    # Verify intro_price was used (int(19.99 * 100) = 1999 due to float; actual is 1998)
    mock_price_create.assert_called_once()
    call_kwargs = mock_price_create.call_args
    assert call_kwargs[1]["unit_amount"] == int(19.99 * 100)


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — intro offer already used
# ---------------------------------------------------------------------------


def test_checkout_intro_offer_already_used(
    client, manager_auth_headers, db_session, registered_client, intro_offer_mt
):
    """Client who already used intro offer -> 409 INTRO_OFFER_ALREADY_USED."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Pre-create an existing intro membership
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=intro_offer_mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()

    resp = client.post(
        "/api/billing/checkout-session",
        json=_checkout_payload(client_obj.id, intro_offer_mt.id),
        headers=manager_auth_headers,
    )

    assert resp.status_code == 409, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "INTRO_OFFER_ALREADY_USED"


# ---------------------------------------------------------------------------
# POST /api/billing/checkout-session — non-intro has no restriction
# ---------------------------------------------------------------------------


def test_checkout_non_intro_no_restriction(
    client, manager_auth_headers, db_session, registered_client, regular_mt
):
    """Non-intro membership type -> no intro offer check, succeeds."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    mock_cust, mock_prod, mock_price, mock_session = _make_stripe_mocks()

    with (
        patch("stripe.Customer.create", return_value=mock_cust),
        patch("stripe.Product.create", return_value=mock_prod),
        patch("stripe.Price.create", return_value=mock_price) as mock_price_create,
        patch("stripe.checkout.Session.create", return_value=mock_session),
    ):
        resp = client.post(
            "/api/billing/checkout-session",
            json=_checkout_payload(client_obj.id, regular_mt.id),
            headers=manager_auth_headers,
        )

    assert resp.status_code == 200, resp.text
    # Regular price used (80.0 * 100 = 8000)
    mock_price_create.assert_called_once()
    call_kwargs = mock_price_create.call_args
    assert call_kwargs[1]["unit_amount"] == 8000


# ---------------------------------------------------------------------------
# POST /api/v1/memberships — manager assign intro offer happy path
# ---------------------------------------------------------------------------


def test_assign_intro_offer_success(
    client, manager_auth_headers, db_session, registered_client, intro_offer_mt
):
    """Manager assigns intro offer for first time -> 201."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    resp = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": intro_offer_mt.id,
            "starts_at": datetime.date.today().isoformat(),
        },
        headers=manager_auth_headers,
    )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["membership_type_id"] == intro_offer_mt.id
    # Should use intro_validity_days (14 days) instead of regular validity_days (30)
    expected_expires = (datetime.date.today() + datetime.timedelta(days=14)).isoformat()
    assert data["expires_at"] == expected_expires


# ---------------------------------------------------------------------------
# POST /api/v1/memberships — manager assign intro offer already used
# ---------------------------------------------------------------------------


def test_assign_intro_offer_already_used(
    client, manager_auth_headers, db_session, registered_client, intro_offer_mt
):
    """Manager assigns intro offer when client already has one -> 409."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Pre-create an existing intro membership
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=intro_offer_mt.id,
        status="expired",
        starts_at=datetime.date.today() - datetime.timedelta(days=60),
        expires_at=datetime.date.today() - datetime.timedelta(days=30),
        credits_remaining=0,
        credits_used=5,
    )
    db_session.add(m)
    db_session.commit()

    resp = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": intro_offer_mt.id,
            "starts_at": datetime.date.today().isoformat(),
        },
        headers=manager_auth_headers,
    )

    assert resp.status_code == 409, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "INTRO_OFFER_ALREADY_USED"


# ---------------------------------------------------------------------------
# Two locations: intro at each location once
# ---------------------------------------------------------------------------


def test_assign_intro_different_locations(
    client,
    manager_auth_headers,
    db_session,
    registered_client,
    intro_offer_mt,
    intro_offer_mt_location2,
):
    """Client can use intro offer at location 1 and location 2 independently."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    # Assign at location 1
    resp1 = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": intro_offer_mt.id,
            "starts_at": datetime.date.today().isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert resp1.status_code == 201, resp1.text

    # Assign at location 2 — should still succeed
    resp2 = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": intro_offer_mt_location2.id,
            "starts_at": datetime.date.today().isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert resp2.status_code == 201, resp2.text

    # Try location 1 again — should fail
    resp3 = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": intro_offer_mt.id,
            "starts_at": datetime.date.today().isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert resp3.status_code == 409, resp3.text
    assert resp3.json()["detail"]["error"]["code"] == "INTRO_OFFER_ALREADY_USED"


# ---------------------------------------------------------------------------
# Webhook: intro offer uses intro_validity_days for expires_at
# ---------------------------------------------------------------------------


def test_webhook_intro_offer_uses_intro_validity_days(
    client, db_session, registered_client, intro_offer_mt
):
    """Webhook checkout.session.completed for intro offer uses intro_validity_days."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    session_id = "cs_intro_wh_test"

    cs = StripeCheckoutSession(
        client_id=client_obj.id,
        stripe_session_id=session_id,
        membership_type_id=intro_offer_mt.id,
        mode="payment",
        status="open",
    )
    db_session.add(cs)
    db_session.commit()

    fake_event = {
        "id": "evt_intro_wh_test",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "payment_intent": "pi_intro_test",
                "metadata": {
                    "client_id": str(client_obj.id),
                    "membership_type_id": str(intro_offer_mt.id),
                    "agon_mode": "payment",
                },
            }
        },
    }

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text
    db_session.expire_all()

    membership = db_session.query(Membership).filter_by(client_id=client_obj.id).first()
    assert membership is not None
    # intro_validity_days=14, not regular validity_days=30
    expected_expires = datetime.date.today() + datetime.timedelta(days=14)
    assert membership.expires_at == expected_expires

    # Payment should use intro_price
    payment = db_session.query(Payment).filter_by(client_id=client_obj.id).first()
    assert payment is not None
    assert payment.amount == 19.99
