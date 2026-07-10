"""Tests for Gift Cards CRUD, manual issuance, and validation."""

from datetime import timedelta

import pytest
from app.config import settings
from app.models.gift_card import GiftCard
from app.services.gift_card_service import generate_gift_card_code
from app.utils import utcnow

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def active_gift_card(db_session):
    """A gift card worth 50.0 EUR, fully unspent."""
    gc = GiftCard(
        code="GC-AAAAAAAA",
        initial_value=50.0,
        remaining_balance=50.0,
        is_active=True,
    )
    db_session.add(gc)
    db_session.commit()
    db_session.refresh(gc)
    return gc


@pytest.fixture
def membership_type_for_gift_card(db_session):
    """A membership type priced at 100.0 EUR."""
    from app.models.membership_type import MembershipType

    mt = MembershipType(
        name="Monthly Unlimited",
        type="credit_pack",
        price=100.0,
        credits_included=10,
        is_active=True,
        sellable_online=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


# ── Code generation ───────────────────────────────────────────────────────────


def test_generate_gift_card_code_format(db_session):
    code = generate_gift_card_code(db_session)
    assert code.startswith("GC-")
    assert len(code) == 11  # "GC-" + 8 chars
    suffix = code[3:]
    assert suffix.isupper() or suffix.isdigit() or suffix.isalnum()


def test_generate_gift_card_code_unique(db_session, active_gift_card):
    """Generated code never collides with an existing one."""
    code = generate_gift_card_code(db_session)
    assert code != active_gift_card.code


# ── Issuance: create ──────────────────────────────────────────────────────────


def test_issue_gift_card(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/gift-cards",
        json={
            "initial_value": 75.0,
            "recipient_name": "Jane Doe",
            "recipient_email": "jane@example.com",
            "message": "Happy Birthday!",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["initial_value"] == 75.0
    assert data["remaining_balance"] == 75.0
    assert data["currency"] == "EUR"
    assert data["code"].startswith("GC-")
    assert data["purchaser_client_id"] is None
    assert data["recipient_name"] == "Jane Doe"
    assert data["is_active"] is True


def test_issue_gift_card_minimal(client, manager_auth_headers):
    """Issuance with only initial_value succeeds; optional fields default to null."""
    resp = client.post(
        "/api/v1/gift-cards",
        json={"initial_value": 25.0},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recipient_name"] is None
    assert data["recipient_email"] is None
    assert data["message"] is None
    assert data["expires_at"] is None


# ── Issuance: list ────────────────────────────────────────────────────────────


def test_list_gift_cards(client, manager_auth_headers, active_gift_card):
    resp = client.get("/api/v1/gift-cards", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    codes = [g["code"] for g in data]
    assert "GC-AAAAAAAA" in codes


def test_list_gift_cards_active_only(client, manager_auth_headers, db_session, active_gift_card):
    """active_only=true filters out inactive gift cards."""
    inactive = GiftCard(
        code="GC-BBBBBBBB",
        initial_value=10.0,
        remaining_balance=10.0,
        is_active=False,
    )
    db_session.add(inactive)
    db_session.commit()

    resp = client.get("/api/v1/gift-cards?active_only=true", headers=manager_auth_headers)
    assert resp.status_code == 200
    codes = [g["code"] for g in resp.json()]
    assert "GC-BBBBBBBB" not in codes
    assert "GC-AAAAAAAA" in codes


# ── Issuance: get ─────────────────────────────────────────────────────────────


def test_get_gift_card(client, manager_auth_headers, active_gift_card):
    resp = client.get(f"/api/v1/gift-cards/{active_gift_card.id}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["code"] == "GC-AAAAAAAA"


def test_get_gift_card_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/gift-cards/999999", headers=manager_auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_NOT_FOUND"


# ── Issuance: deactivate ──────────────────────────────────────────────────────


def test_deactivate_gift_card(client, manager_auth_headers, active_gift_card):
    resp = client.delete(f"/api/v1/gift-cards/{active_gift_card.id}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_deactivate_gift_card_not_found(client, manager_auth_headers):
    resp = client.delete("/api/v1/gift-cards/999999", headers=manager_auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_NOT_FOUND"


# ── Validate: valid code ──────────────────────────────────────────────────────


def test_validate_valid_gift_card(client, client_auth_headers, active_gift_card):
    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-AAAAAAAA"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["remaining_balance"] == 50.0
    assert data["currency"] == "EUR"


def test_validate_does_not_deduct_balance(
    client, client_auth_headers, db_session, active_gift_card
):
    """Validation is read-only — balance is unchanged after validating."""
    client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-AAAAAAAA"},
        headers=client_auth_headers,
    )
    db_session.refresh(active_gift_card)
    assert active_gift_card.remaining_balance == 50.0


# ── Validate: not found ───────────────────────────────────────────────────────


def test_validate_nonexistent_gift_card(client, client_auth_headers):
    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-NOPE0000"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_NOT_FOUND"


# ── Validate: inactive ────────────────────────────────────────────────────────


def test_validate_inactive_gift_card(client, client_auth_headers, db_session):
    gc = GiftCard(
        code="GC-DEADDEAD",
        initial_value=10.0,
        remaining_balance=10.0,
        is_active=False,
    )
    db_session.add(gc)
    db_session.commit()

    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-DEADDEAD"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_INACTIVE"


# ── Validate: expired ─────────────────────────────────────────────────────────


def test_validate_expired_gift_card(client, client_auth_headers, db_session):
    now = utcnow()
    gc = GiftCard(
        code="GC-EXPIRED1",
        initial_value=10.0,
        remaining_balance=10.0,
        is_active=True,
        expires_at=now - timedelta(days=1),
    )
    db_session.add(gc)
    db_session.commit()

    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-EXPIRED1"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_EXPIRED"


# ── Validate: zero balance ────────────────────────────────────────────────────


def test_validate_zero_balance_gift_card(client, client_auth_headers, db_session):
    gc = GiftCard(
        code="GC-ZEROOOOO",
        initial_value=10.0,
        remaining_balance=0.0,
        is_active=True,
    )
    db_session.add(gc)
    db_session.commit()

    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-ZEROOOOO"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "GIFT_CARD_ZERO_BALANCE"


# ── IDOR: client cannot access CRUD endpoints ───────────────────────────────


def test_client_cannot_list_gift_cards(client, client_auth_headers):
    resp = client.get("/api/v1/gift-cards", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_issue_gift_card(client, client_auth_headers):
    resp = client.post(
        "/api/v1/gift-cards",
        json={"initial_value": 100.0},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_get_gift_card(client, client_auth_headers, active_gift_card):
    resp = client.get(f"/api/v1/gift-cards/{active_gift_card.id}", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_deactivate_gift_card(client, client_auth_headers, active_gift_card):
    resp = client.delete(f"/api/v1/gift-cards/{active_gift_card.id}", headers=client_auth_headers)
    assert resp.status_code == 403


# ── Redemption service ────────────────────────────────────────────────────────


def test_redeem_gift_card_partial(db_session, active_gift_card, registered_client):
    from app.models.client import Client
    from app.services.gift_card_service import redeem_gift_card

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    gc, redemption = redeem_gift_card(
        db=db_session,
        code="GC-AAAAAAAA",
        client_id=client_obj.id,
        amount=20.0,
    )
    db_session.commit()

    assert gc.remaining_balance == 30.0
    assert redemption.amount == 20.0
    assert redemption.balance_after == 30.0


def test_redeem_gift_card_never_goes_negative(db_session, active_gift_card, registered_client):
    """Redeeming more than the balance caps the deduction at remaining_balance."""
    from app.models.client import Client
    from app.services.gift_card_service import redeem_gift_card

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    gc, redemption = redeem_gift_card(
        db=db_session,
        code="GC-AAAAAAAA",
        client_id=client_obj.id,
        amount=1000.0,
    )
    db_session.commit()

    assert gc.remaining_balance == 0.0
    assert redemption.amount == 50.0
    assert redemption.balance_after == 0.0


# ── Integration: checkout-session purchase ────────────────────────────────────


def test_gift_card_checkout_session_stripe_not_configured(client, client_auth_headers):
    """Verify the checkout-session endpoint reaches the Stripe step (503) when
    Stripe is not configured, proving request validation passed first.
    """
    original_stripe_key = settings.STRIPE_SECRET_KEY
    settings.STRIPE_SECRET_KEY = ""
    try:
        resp = client.post(
            "/api/v1/gift-cards/checkout-session",
            json={
                "amount": 50.0,
                "recipient_name": "Jane Doe",
                "recipient_email": "jane@example.com",
                "message": "Happy Birthday!",
                "success_url": "http://localhost/success",
                "cancel_url": "http://localhost/cancel",
            },
            headers=client_auth_headers,
        )
    finally:
        settings.STRIPE_SECRET_KEY = original_stripe_key
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "STRIPE_NOT_CONFIGURED"


# ── Integration: membership checkout with gift card ───────────────────────────


def test_checkout_with_gift_card_partial_coverage(
    client, manager_auth_headers, db_session, membership_type_for_gift_card, active_gift_card
):
    """Gift card partially covers price; remainder still requires Stripe."""
    from app.auth import hash_password
    from app.models.client import Client

    c = Client(
        email="giftbuyer@example.com",
        password_hash=hash_password("buyerpass1"),
        full_name="Gift Buyer",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    original_stripe_key = settings.STRIPE_SECRET_KEY
    settings.STRIPE_SECRET_KEY = ""
    try:
        resp = client.post(
            "/api/billing/checkout-session",
            json={
                "client_id": c.id,
                "membership_type_id": membership_type_for_gift_card.id,
                "success_url": "http://localhost/success",
                "cancel_url": "http://localhost/cancel",
                "gift_card_code": "GC-AAAAAAAA",
            },
            headers=manager_auth_headers,
        )
    finally:
        settings.STRIPE_SECRET_KEY = original_stripe_key
    # Gift card (50) covers part of the 100 price; remainder still needs Stripe,
    # which is not configured in tests.
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "STRIPE_NOT_CONFIGURED"


def test_checkout_with_gift_card_full_coverage(
    client, manager_auth_headers, db_session, active_gift_card
):
    """Gift card fully covers price -> membership granted immediately, no Stripe."""
    from app.auth import hash_password
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType

    # Membership type priced at or below the gift card's balance (50.0).
    mt = MembershipType(
        name="Single Class",
        type="credit_pack",
        price=50.0,
        credits_included=1,
        is_active=True,
        sellable_online=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)

    c = Client(
        email="fullgift@example.com",
        password_hash=hash_password("buyerpass1"),
        full_name="Full Gift Buyer",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    resp = client.post(
        "/api/billing/checkout-session",
        json={
            "client_id": c.id,
            "membership_type_id": mt.id,
            "success_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
            "gift_card_code": "GC-AAAAAAAA",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["already_completed"] is True
    assert data["checkout_url"] is None
    assert data["membership_id"] is not None

    membership = db_session.query(Membership).filter(Membership.id == data["membership_id"]).first()
    assert membership is not None
    assert membership.client_id == c.id
    assert membership.status == "active"

    db_session.refresh(active_gift_card)
    assert active_gift_card.remaining_balance == 0.0
