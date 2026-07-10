"""Tests for Promo Codes CRUD, validation, and discount calculation."""

import json
from datetime import timedelta

import pytest
from app.config import settings
from app.models.membership_type import MembershipType
from app.models.promo_code import PromoCode
from app.models.promo_code_usage import PromoCodeUsage
from app.services.promo_code_service import apply_discount
from app.utils import utcnow

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def membership_type_for_promo(db_session):
    """A membership type priced at 100.0 EUR."""
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


@pytest.fixture
def second_membership_type(db_session):
    """A second membership type priced at 50.0 EUR."""
    mt = MembershipType(
        name="5-Class Pack",
        type="credit_pack",
        price=50.0,
        credits_included=5,
        is_active=True,
        sellable_online=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def active_promo(db_session, membership_type_for_promo):
    """A 20% off promo code, valid now, no max uses."""
    now = utcnow()
    promo = PromoCode(
        code="SUMMER20",
        discount_type="percentage",
        discount_value=20.0,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=30),
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()
    db_session.refresh(promo)
    return promo


@pytest.fixture
def fixed_promo(db_session, membership_type_for_promo):
    """A fixed 15 EUR off promo code."""
    now = utcnow()
    promo = PromoCode(
        code="FLAT15",
        discount_type="fixed",
        discount_value=15.0,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=30),
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()
    db_session.refresh(promo)
    return promo


# ── Pure function: apply_discount ─────────────────────────────────────────────


def test_percentage_discount():
    discount_amount, final_price = apply_discount(100.0, "percentage", 20.0)
    assert discount_amount == 20.0
    assert final_price == 80.0


def test_fixed_discount():
    discount_amount, final_price = apply_discount(100.0, "fixed", 15.0)
    assert discount_amount == 15.0
    assert final_price == 85.0


def test_fixed_discount_exceeds_price():
    """Fixed discount greater than price results in final_price=0, not negative."""
    discount_amount, final_price = apply_discount(10.0, "fixed", 25.0)
    assert final_price == 0.0
    assert discount_amount == 10.0


# ── CRUD: create ──────────────────────────────────────────────────────────────


def test_create_promo_code(client, manager_auth_headers):
    now = utcnow()
    resp = client.post(
        "/api/v1/promo-codes",
        json={
            "code": "NEWCODE",
            "discount_type": "percentage",
            "discount_value": 10.0,
            "valid_from": now.isoformat(),
            "valid_until": (now + timedelta(days=30)).isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "NEWCODE"
    assert data["discount_type"] == "percentage"
    assert data["discount_value"] == 10.0
    assert data["current_uses"] == 0
    assert data["is_active"] is True


# ── CRUD: list ────────────────────────────────────────────────────────────────


def test_list_promo_codes(client, manager_auth_headers, active_promo):
    resp = client.get("/api/v1/promo-codes", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    codes = [p["code"] for p in data]
    assert "SUMMER20" in codes


def test_list_promo_codes_active_only(client, manager_auth_headers, db_session, active_promo):
    """active_only=true filters out inactive promos."""
    now = utcnow()
    inactive = PromoCode(
        code="INACTIVE",
        discount_type="percentage",
        discount_value=5.0,
        valid_from=now - timedelta(days=1),
        is_active=False,
    )
    db_session.add(inactive)
    db_session.commit()

    resp = client.get("/api/v1/promo-codes?active_only=true", headers=manager_auth_headers)
    assert resp.status_code == 200
    codes = [p["code"] for p in resp.json()]
    assert "INACTIVE" not in codes
    assert "SUMMER20" in codes


# ── CRUD: get ─────────────────────────────────────────────────────────────────


def test_get_promo_code(client, manager_auth_headers, active_promo):
    resp = client.get(f"/api/v1/promo-codes/{active_promo.id}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["code"] == "SUMMER20"


# ── CRUD: update ──────────────────────────────────────────────────────────────


def test_update_promo_code(client, manager_auth_headers, active_promo):
    resp = client.put(
        f"/api/v1/promo-codes/{active_promo.id}",
        json={"discount_value": 30.0},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["discount_value"] == 30.0


# ── CRUD: deactivate ─────────────────────────────────────────────────────────


def test_deactivate_promo_code(client, manager_auth_headers, active_promo):
    resp = client.delete(f"/api/v1/promo-codes/{active_promo.id}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# ── Validate: valid code returns correct discount ────────────────────────────


def test_validate_valid_percentage_code(
    client, client_auth_headers, active_promo, membership_type_for_promo
):
    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "SUMMER20", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["discount_type"] == "percentage"
    assert data["discount_value"] == 20.0
    assert data["discount_amount"] == 20.0
    assert data["original_price"] == 100.0
    assert data["final_price"] == 80.0


def test_validate_valid_fixed_code(
    client, client_auth_headers, fixed_promo, membership_type_for_promo
):
    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "FLAT15", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["discount_amount"] == 15.0
    assert data["final_price"] == 85.0


# ── Validate: expired code ───────────────────────────────────────────────────


def test_validate_expired_code(client, client_auth_headers, db_session, membership_type_for_promo):
    now = utcnow()
    promo = PromoCode(
        code="EXPIRED",
        discount_type="percentage",
        discount_value=10.0,
        valid_from=now - timedelta(days=30),
        valid_until=now - timedelta(days=1),
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()

    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "EXPIRED", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_EXPIRED"


# ── Validate: max uses reached ───────────────────────────────────────────────


def test_validate_max_uses_reached(
    client, client_auth_headers, db_session, membership_type_for_promo
):
    now = utcnow()
    promo = PromoCode(
        code="MAXED",
        discount_type="percentage",
        discount_value=10.0,
        valid_from=now - timedelta(days=1),
        max_uses=1,
        current_uses=1,
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()

    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "MAXED", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_MAX_USES"


# ── Validate: one_per_client already used ────────────────────────────────────


def test_validate_one_per_client_already_used(
    client,
    client_auth_headers,
    registered_client,
    db_session,
    membership_type_for_promo,
):
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    now = utcnow()
    promo = PromoCode(
        code="ONCE",
        discount_type="percentage",
        discount_value=10.0,
        valid_from=now - timedelta(days=1),
        one_per_client=True,
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()
    db_session.refresh(promo)

    usage = PromoCodeUsage(
        promo_code_id=promo.id,
        client_id=client_obj.id,
        discount_amount=10.0,
        used_at=now,
    )
    db_session.add(usage)
    db_session.commit()

    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "ONCE", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_ALREADY_USED"


# ── Validate: wrong membership type ─────────────────────────────────────────


def test_validate_wrong_membership_type(
    client,
    client_auth_headers,
    db_session,
    membership_type_for_promo,
    second_membership_type,
):
    now = utcnow()
    promo = PromoCode(
        code="SPECIFIC",
        discount_type="percentage",
        discount_value=10.0,
        valid_from=now - timedelta(days=1),
        applicable_membership_type_ids=json.dumps([second_membership_type.id]),
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()

    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "SPECIFIC", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_WRONG_TYPE"


# ── Validate: inactive code ─────────────────────────────────────────────────


def test_validate_inactive_code(client, client_auth_headers, db_session, membership_type_for_promo):
    now = utcnow()
    promo = PromoCode(
        code="DEAD",
        discount_type="percentage",
        discount_value=10.0,
        valid_from=now - timedelta(days=1),
        is_active=False,
    )
    db_session.add(promo)
    db_session.commit()

    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "DEAD", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_INVALID"


# ── Validate: code not found ─────────────────────────────────────────────────


def test_validate_nonexistent_code(client, client_auth_headers, membership_type_for_promo):
    resp = client.post(
        "/api/v1/promo-codes/validate",
        json={"code": "NOPE", "membership_type_id": membership_type_for_promo.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_INVALID"


# ── IDOR: client cannot access CRUD endpoints ───────────────────────────────


def test_client_cannot_list_promo_codes(client, client_auth_headers):
    resp = client.get("/api/v1/promo-codes", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_create_promo_code(client, client_auth_headers):
    now = utcnow()
    resp = client.post(
        "/api/v1/promo-codes",
        json={
            "code": "HACK",
            "discount_type": "percentage",
            "discount_value": 100.0,
            "valid_from": now.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_get_promo_code(client, client_auth_headers, active_promo):
    resp = client.get(f"/api/v1/promo-codes/{active_promo.id}", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_update_promo_code(client, client_auth_headers, active_promo):
    resp = client.put(
        f"/api/v1/promo-codes/{active_promo.id}",
        json={"discount_value": 99.0},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_delete_promo_code(client, client_auth_headers, active_promo):
    resp = client.delete(f"/api/v1/promo-codes/{active_promo.id}", headers=client_auth_headers)
    assert resp.status_code == 403


# ── Integration: checkout with promo code ────────────────────────────────────


def test_checkout_with_promo_code_metadata(
    client, manager_auth_headers, db_session, membership_type_for_promo, active_promo
):
    """Verify that the checkout endpoint accepts and validates a promo_code.

    We cannot call Stripe in tests, but we can verify validation succeeds
    before the Stripe call happens. The endpoint will fail at the Stripe step
    (STRIPE_NOT_CONFIGURED), but by that point the promo has been validated.
    """
    # Create a client to purchase for
    from app.auth import hash_password
    from app.models.client import Client

    c = Client(
        email="buyer@example.com",
        password_hash=hash_password("buyerpass1"),
        full_name="Buyer",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    # Force STRIPE_NOT_CONFIGURED regardless of ambient .env state (e.g. a
    # real Stripe test-mode key set for manual local dev testing).
    original_stripe_key = settings.STRIPE_SECRET_KEY
    settings.STRIPE_SECRET_KEY = ""
    try:
        resp = client.post(
            "/api/billing/checkout-session",
            json={
                "client_id": c.id,
                "membership_type_id": membership_type_for_promo.id,
                "success_url": "http://localhost/success",
                "cancel_url": "http://localhost/cancel",
                "promo_code": "SUMMER20",
            },
            headers=manager_auth_headers,
        )
    finally:
        settings.STRIPE_SECRET_KEY = original_stripe_key
    # Stripe is not configured in tests, so we expect 503
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "STRIPE_NOT_CONFIGURED"


def test_checkout_with_invalid_promo_code(
    client, manager_auth_headers, db_session, membership_type_for_promo
):
    """Checkout with a non-existent promo code returns 404 before hitting Stripe."""
    from app.auth import hash_password
    from app.models.client import Client

    c = Client(
        email="buyer2@example.com",
        password_hash=hash_password("buyerpass2"),
        full_name="Buyer 2",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    resp = client.post(
        "/api/billing/checkout-session",
        json={
            "client_id": c.id,
            "membership_type_id": membership_type_for_promo.id,
            "success_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
            "promo_code": "DOESNOTEXIST",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "PROMO_CODE_INVALID"
