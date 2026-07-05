"""Tests for Phase 4 Stripe billing — recurring subscriptions.

Endpoints and webhook handlers tested:
  POST /api/billing/checkout-session          (subscription mode)
  POST /api/billing/webhook                   (subscription events)
  GET  /api/billing/members/{id}/subscription
  POST /api/billing/members/{id}/subscription/cancel
"""

import os

os.environ["AGON_ENV"] = "test"

import time
from datetime import datetime
from unittest.mock import MagicMock, patch

import app.models  # noqa — registers all models with Base.metadata
import pytest
from app.config import settings
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.payment import Payment
from app.models.stripe_checkout_session import StripeCheckoutSession
from app.models.stripe_customer import StripeCustomer
from app.models.stripe_subscription import StripeSubscription

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def recurring_mt(db_session):
    """A monthly recurring MembershipType that is sellable online."""
    mt = MembershipType(
        name="Monthly Unlimited",
        type="recurring",
        price=79.0,
        currency="EUR",
        billing_interval="monthly",
        credits_included=None,
        validity_days=None,
        is_active=True,
        sellable_online=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture(autouse=True)
def stripe_secret_key():
    """Ensure STRIPE_SECRET_KEY is set; reset after."""
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
    session_id: str = "cs_sub_001", url: str = "https://checkout.stripe.com/pay/sub"
):
    m = MagicMock()
    m.id = session_id
    m.url = url
    return m


def _make_stripe_customer(customer_id: str = "cus_sub_001"):
    m = MagicMock()
    m.id = customer_id
    return m


def _make_stripe_product(product_id: str = "prod_sub_001"):
    m = MagicMock()
    m.id = product_id
    return m


def _make_stripe_price(price_id: str = "price_sub_001"):
    m = MagicMock()
    m.id = price_id
    return m


def _future_ts(offset_days: int = 30) -> int:
    """Unix timestamp that is offset_days in the future."""
    return int(time.time()) + offset_days * 86400


def _sub_event(
    event_id: str,
    event_type: str,
    sub_id: str,
    customer_id: str,
    price_id: str,
    status: str = "active",
    current_period_end: int | None = None,
) -> dict:
    if current_period_end is None:
        current_period_end = _future_ts(30)
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": sub_id,
                "customer": customer_id,
                "status": status,
                "current_period_end": current_period_end,
                "items": {
                    "data": [
                        {
                            "price": {"id": price_id},
                        }
                    ]
                },
            }
        },
    }


def _invoice_event(
    event_id: str,
    event_type: str,
    invoice_id: str,
    sub_id: str | None,
    amount_paid: int = 7900,
    period_end: int | None = None,
) -> dict:
    if period_end is None:
        period_end = _future_ts(30)
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": invoice_id,
                "subscription": sub_id,
                "payment_intent": "pi_sub_001",
                "amount_paid": amount_paid,
                "currency": "eur",
                "lines": {
                    "data": [
                        {
                            "period": {"end": period_end},
                        }
                    ]
                },
            }
        },
    }


def _checkout_payload(client_id: int, mt_id: int) -> dict:
    return {
        "client_id": client_id,
        "membership_type_id": mt_id,
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
    }


# ---------------------------------------------------------------------------
# test_checkout_session_subscription_mode
# ---------------------------------------------------------------------------


def test_checkout_session_subscription_mode(
    client, manager_auth_headers, db_session, registered_client, recurring_mt
):
    """Recurring membership type → checkout session uses mode='subscription',
    StripePrice created with is_recurring=True."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    mock_cust = _make_stripe_customer()
    mock_prod = _make_stripe_product()
    mock_price = _make_stripe_price()
    mock_session = _make_stripe_session()

    with (
        patch("stripe.Customer.create", return_value=mock_cust),
        patch("stripe.Product.create", return_value=mock_prod),
        patch("stripe.Price.create", return_value=mock_price),
        patch("stripe.checkout.Session.create", return_value=mock_session) as mock_sess_create,
    ):
        resp = client.post(
            "/api/billing/checkout-session",
            json=_checkout_payload(client_obj.id, recurring_mt.id),
            headers=manager_auth_headers,
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["checkout_url"] == mock_session.url
    assert data["session_id"] == mock_session.id

    # StripeCheckoutSession row — mode must be "subscription"
    cs = (
        db_session.query(StripeCheckoutSession).filter_by(stripe_session_id=mock_session.id).first()
    )
    assert cs is not None
    assert cs.mode == "subscription"
    assert cs.status == "open"

    # StripePrice row — is_recurring must be True
    from app.models.stripe_price import StripePrice

    sp = db_session.query(StripePrice).filter_by(membership_type_id=recurring_mt.id).first()
    assert sp is not None
    assert sp.is_recurring is True
    assert sp.billing_interval == "month"

    # Session.create was called with mode="subscription"
    call_kwargs = mock_sess_create.call_args.kwargs
    assert call_kwargs["mode"] == "subscription"
    # payment_intent_data must NOT be present for subscription mode
    assert "payment_intent_data" not in call_kwargs


# ---------------------------------------------------------------------------
# test_webhook_subscription_created_grants_membership
# ---------------------------------------------------------------------------


def test_webhook_subscription_created_grants_membership(
    client, db_session, registered_client, recurring_mt
):
    """customer.subscription.created with status=active → StripeSubscription and Membership rows created."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_test_001"
    customer_id = "cus_sub_001"

    # Pre-create StripeCustomer
    sc = StripeCustomer(client_id=client_obj.id, stripe_customer_id=customer_id)
    db_session.add(sc)

    # Pre-create a complete StripeCheckoutSession so the handler can find the membership type
    cs = StripeCheckoutSession(
        client_id=client_obj.id,
        stripe_session_id="cs_sub_pre_001",
        membership_type_id=recurring_mt.id,
        mode="subscription",
        status="complete",
    )
    db_session.add(cs)
    db_session.commit()

    fake_event = _sub_event(
        event_id="evt_sub_created_001",
        event_type="customer.subscription.created",
        sub_id=sub_id,
        customer_id=customer_id,
        price_id="price_sub_001",
        status="active",
    )

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ok"

    db_session.expire_all()

    # StripeSubscription row created
    stripe_sub = (
        db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).first()
    )
    assert stripe_sub is not None
    assert stripe_sub.status == "active"
    assert stripe_sub.client_id == client_obj.id

    # Membership row created with stripe_subscription_id set
    membership = (
        db_session.query(Membership)
        .filter_by(client_id=client_obj.id, stripe_subscription_id=sub_id)
        .first()
    )
    assert membership is not None
    assert membership.status == "active"
    assert membership.stripe_subscription_id == sub_id


# ---------------------------------------------------------------------------
# test_webhook_subscription_updated_status_change
# ---------------------------------------------------------------------------


def test_webhook_subscription_updated_status_change(
    client, db_session, registered_client, recurring_mt
):
    """customer.subscription.updated with status=past_due → existing StripeSubscription row updated."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_upd_001"
    customer_id = "cus_sub_upd_001"

    # Pre-create StripeCustomer and existing StripeSubscription
    sc = StripeCustomer(client_id=client_obj.id, stripe_customer_id=customer_id)
    db_session.add(sc)
    existing_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_sub_upd_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(10)),
    )
    db_session.add(existing_sub)
    db_session.commit()

    fake_event = _sub_event(
        event_id="evt_sub_updated_001",
        event_type="customer.subscription.updated",
        sub_id=sub_id,
        customer_id=customer_id,
        price_id="price_sub_upd_001",
        status="past_due",
    )

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()

    updated_sub = (
        db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).first()
    )
    assert updated_sub is not None
    assert updated_sub.status == "past_due"

    # Only one row should exist — no duplicate
    count = db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).count()
    assert count == 1


# ---------------------------------------------------------------------------
# test_webhook_subscription_deleted_cancels_membership
# ---------------------------------------------------------------------------


def test_webhook_subscription_deleted_cancels_membership(
    client, db_session, registered_client, recurring_mt
):
    """customer.subscription.deleted → Membership.status set to 'cancelled'."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_del_001"
    customer_id = "cus_sub_del_001"

    sc = StripeCustomer(client_id=client_obj.id, stripe_customer_id=customer_id)
    db_session.add(sc)

    # Active StripeSubscription
    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_del_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(5)),
    )
    db_session.add(stripe_sub)

    # Active Membership tied to subscription
    import datetime as dt

    membership = Membership(
        client_id=client_obj.id,
        membership_type_id=recurring_mt.id,
        status="active",
        starts_at=dt.date.today(),
        stripe_subscription_id=sub_id,
        credits_remaining=None,
        credits_used=0,
    )
    db_session.add(membership)
    db_session.commit()

    fake_event = {
        "id": "evt_sub_deleted_001",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": sub_id,
                "customer": customer_id,
                "status": "canceled",
                "current_period_end": _future_ts(5),
                "items": {"data": [{"price": {"id": "price_del_001"}}]},
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

    updated_sub = (
        db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).first()
    )
    assert updated_sub.status == "canceled"

    updated_mem = (
        db_session.query(Membership)
        .filter_by(client_id=client_obj.id, stripe_subscription_id=sub_id)
        .first()
    )
    assert updated_mem.status == "cancelled"


# ---------------------------------------------------------------------------
# test_webhook_invoice_paid_records_payment
# ---------------------------------------------------------------------------


def test_webhook_invoice_paid_records_payment(client, db_session, registered_client, recurring_mt):
    """invoice.paid with a subscription id → Payment row created."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_inv_001"
    customer_id = "cus_inv_001"

    sc = StripeCustomer(client_id=client_obj.id, stripe_customer_id=customer_id)
    db_session.add(sc)

    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_inv_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(30)),
    )
    db_session.add(stripe_sub)

    import datetime as dt

    membership = Membership(
        client_id=client_obj.id,
        membership_type_id=recurring_mt.id,
        status="active",
        starts_at=dt.date.today(),
        stripe_subscription_id=sub_id,
        credits_remaining=None,
        credits_used=0,
    )
    db_session.add(membership)
    db_session.commit()

    fake_event = _invoice_event(
        event_id="evt_inv_paid_001",
        event_type="invoice.paid",
        invoice_id="in_001",
        sub_id=sub_id,
        amount_paid=7900,
    )

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()

    payment = db_session.query(Payment).filter_by(client_id=client_obj.id).first()
    assert payment is not None
    assert payment.status == "completed"
    assert payment.provider == "stripe"
    assert payment.amount == pytest.approx(79.0)
    assert payment.currency == "EUR"
    assert payment.provider_invoice_id == "in_001"


# ---------------------------------------------------------------------------
# test_webhook_invoice_payment_failed_flags_membership
# ---------------------------------------------------------------------------


def test_webhook_invoice_payment_failed_flags_membership(
    client, db_session, registered_client, recurring_mt
):
    """invoice.payment_failed → Membership.status set to 'payment_overdue', NOT deleted."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_fail_001"
    customer_id = "cus_fail_001"

    sc = StripeCustomer(client_id=client_obj.id, stripe_customer_id=customer_id)
    db_session.add(sc)

    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_fail_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(5)),
    )
    db_session.add(stripe_sub)

    import datetime as dt

    membership = Membership(
        client_id=client_obj.id,
        membership_type_id=recurring_mt.id,
        status="active",
        starts_at=dt.date.today(),
        stripe_subscription_id=sub_id,
        credits_remaining=None,
        credits_used=0,
    )
    db_session.add(membership)
    db_session.commit()

    fake_event = _invoice_event(
        event_id="evt_inv_failed_001",
        event_type="invoice.payment_failed",
        invoice_id="in_fail_001",
        sub_id=sub_id,
    )

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    assert resp.status_code == 200, resp.text

    db_session.expire_all()

    updated_mem = (
        db_session.query(Membership)
        .filter_by(client_id=client_obj.id, stripe_subscription_id=sub_id)
        .first()
    )
    assert updated_mem is not None, "Membership must NOT be deleted"
    assert updated_mem.status == "payment_overdue"


# ---------------------------------------------------------------------------
# test_get_subscription_status
# ---------------------------------------------------------------------------


def test_get_subscription_status(
    client, manager_auth_headers, db_session, registered_client, recurring_mt
):
    """GET /api/billing/members/{id}/subscription → correct structure returned."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_get_001"
    period_end_ts = _future_ts(28)

    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_get_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(period_end_ts),
    )
    db_session.add(stripe_sub)
    db_session.commit()

    resp = client.get(
        f"/api/billing/members/{client_obj.id}/subscription",
        headers=manager_auth_headers,
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["subscription"] is not None
    assert data["subscription"]["stripe_subscription_id"] == sub_id
    assert data["subscription"]["status"] == "active"
    assert data["subscription"]["stripe_price_id"] == "price_get_001"
    assert data["subscription"]["current_period_end"] is not None


def test_get_subscription_status_no_subscription(
    client, manager_auth_headers, db_session, registered_client
):
    """GET subscription when no subscription exists → {'subscription': None}."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    resp = client.get(
        f"/api/billing/members/{client_obj.id}/subscription",
        headers=manager_auth_headers,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"subscription": None}


# ---------------------------------------------------------------------------
# test_cancel_subscription
# ---------------------------------------------------------------------------


def test_cancel_subscription(
    client, manager_auth_headers, db_session, registered_client, recurring_mt
):
    """POST .../cancel → stripe.Subscription.modify called, local status updated."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_cancel_001"

    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_cancel_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(20)),
    )
    db_session.add(stripe_sub)
    db_session.commit()

    mock_modified = MagicMock()
    mock_modified.id = sub_id

    with patch("stripe.Subscription.modify", return_value=mock_modified) as mock_modify:
        resp = client.post(
            f"/api/billing/members/{client_obj.id}/subscription/cancel",
            headers=manager_auth_headers,
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "ok"
    assert data["cancel_at_period_end"] is True

    mock_modify.assert_called_once_with(sub_id, cancel_at_period_end=True)

    db_session.expire_all()
    updated_sub = (
        db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).first()
    )
    assert updated_sub.status == "canceled"


def test_cancel_subscription_not_found(client, manager_auth_headers, db_session, registered_client):
    """POST .../cancel when no active subscription → 404 SUBSCRIPTION_NOT_FOUND."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    resp = client.post(
        f"/api/billing/members/{client_obj.id}/subscription/cancel",
        headers=manager_auth_headers,
    )

    assert resp.status_code == 404, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "SUBSCRIPTION_NOT_FOUND"


# ---------------------------------------------------------------------------
# test_override_cancel_succeeds
# ---------------------------------------------------------------------------


def test_override_cancel_succeeds(
    client, manager_auth_headers, db_session, registered_client, recurring_mt
):
    """POST .../cancel/override → local DB updated, no Stripe call made."""
    import datetime as dt

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    sub_id = "sub_override_001"

    # Pre-create an active StripeSubscription
    stripe_sub = StripeSubscription(
        client_id=client_obj.id,
        stripe_subscription_id=sub_id,
        stripe_price_id="price_override_001",
        status="active",
        current_period_end=datetime.utcfromtimestamp(_future_ts(20)),
    )
    db_session.add(stripe_sub)

    # Pre-create a linked active Membership
    membership = Membership(
        client_id=client_obj.id,
        membership_type_id=recurring_mt.id,
        status="active",
        starts_at=dt.date.today(),
        stripe_subscription_id=sub_id,
        credits_remaining=None,
        credits_used=0,
    )
    db_session.add(membership)
    db_session.commit()

    resp = client.post(
        f"/api/billing/members/{client_obj.id}/subscription/cancel/override",
        headers=manager_auth_headers,
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "ok"
    assert data["override"] is True
    assert data["stripe_subscription_id"] == sub_id

    db_session.expire_all()

    # StripeSubscription must be marked canceled
    updated_sub = (
        db_session.query(StripeSubscription).filter_by(stripe_subscription_id=sub_id).first()
    )
    assert updated_sub is not None
    assert updated_sub.status == "canceled"

    # Linked Membership must be marked cancelled
    updated_mem = (
        db_session.query(Membership)
        .filter_by(client_id=client_obj.id, stripe_subscription_id=sub_id)
        .first()
    )
    assert updated_mem is not None
    assert updated_mem.status == "cancelled"


# ---------------------------------------------------------------------------
# test_override_cancel_not_found
# ---------------------------------------------------------------------------


def test_override_cancel_not_found(client, manager_auth_headers, db_session, registered_client):
    """POST .../cancel/override when no subscription exists → 404 SUBSCRIPTION_NOT_FOUND."""
    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()

    resp = client.post(
        f"/api/billing/members/{client_obj.id}/subscription/cancel/override",
        headers=manager_auth_headers,
    )

    assert resp.status_code == 404, resp.text
    err = resp.json()["detail"]["error"]
    assert err["code"] == "SUBSCRIPTION_NOT_FOUND"
