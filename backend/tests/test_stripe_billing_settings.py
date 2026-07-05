"""Tests for POST/GET /api/billing/settings (Stripe Billing Phase 2)."""

import os

os.environ["AGON_ENV"] = "test"

from unittest.mock import MagicMock, patch

import app.models  # noqa — registers all models with Base.metadata
import pytest
import stripe
from app.models.studio_settings import StudioSettings

# ---------------------------------------------------------------------------
# Fixtures — studio_settings row is required for these endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def studio_settings(db_session):
    """Create StudioSettings id=1 which all billing endpoints depend on."""
    ss = StudioSettings(
        id=1,
        studio_name="Test Studio",
        stripe_connected=False,
        stripe_account_id=None,
    )
    db_session.add(ss)
    db_session.commit()
    db_session.refresh(ss)
    return ss


# ---------------------------------------------------------------------------
# POST /api/billing/settings — success
# ---------------------------------------------------------------------------


def test_post_settings_success(client, manager_auth_headers, db_session, studio_settings):
    """Happy path: valid key → 200, DB updated, secret key never returned."""
    mock_account = MagicMock()
    mock_account.id = "acct_test123"

    with patch("stripe.Account.retrieve", return_value=mock_account) as mock_retrieve:
        with patch("app.routers.stripe_billing._update_env_file") as mock_env:
            response = client.post(
                "/api/billing/settings",
                json={
                    "secret_key": "sk_test_valid",
                    "publishable_key": "pk_test_valid",
                    "webhook_secret": "whsec_test_valid",
                },
                headers=manager_auth_headers,
            )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "ok"
    assert data["stripe_account_id"] == "acct_test123"

    # Stripe was called with the provided key
    mock_retrieve.assert_called_once_with(api_key="sk_test_valid")

    # DB was updated
    db_session.refresh(studio_settings)
    assert studio_settings.stripe_connected is True
    assert studio_settings.stripe_account_id == "acct_test123"

    # Env file update was requested with correct keys
    mock_env.assert_called_once()
    call_kwargs = mock_env.call_args[0][0]
    assert call_kwargs["STRIPE_SECRET_KEY"] == "sk_test_valid"
    assert call_kwargs["STRIPE_PUBLISHABLE_KEY"] == "pk_test_valid"
    assert call_kwargs["STRIPE_WEBHOOK_SECRET"] == "whsec_test_valid"

    # Secret key is not present in the response body
    assert "secret_key" not in data
    assert "sk_test" not in str(data)


# ---------------------------------------------------------------------------
# POST /api/billing/settings — invalid key
# ---------------------------------------------------------------------------


def test_post_settings_invalid_key(client, manager_auth_headers, studio_settings):
    """Authentication error from Stripe → 422 STRIPE_KEY_INVALID."""
    auth_err = stripe.error.AuthenticationError("No such API key", http_status=401, json_body=None)

    with patch("stripe.Account.retrieve", side_effect=auth_err):
        response = client.post(
            "/api/billing/settings",
            json={"secret_key": "sk_wrong", "publishable_key": "pk_wrong"},
            headers=manager_auth_headers,
        )

    assert response.status_code == 422, response.text
    err = response.json()["detail"]["error"]
    assert err["code"] == "STRIPE_KEY_INVALID"


# ---------------------------------------------------------------------------
# POST /api/billing/settings — generic Stripe API error
# ---------------------------------------------------------------------------


def test_post_settings_stripe_api_error(client, manager_auth_headers, studio_settings):
    """Generic StripeError → 502 STRIPE_API_ERROR."""
    stripe_err = stripe.error.StripeError("timeout")

    with patch("stripe.Account.retrieve", side_effect=stripe_err):
        response = client.post(
            "/api/billing/settings",
            json={"secret_key": "sk_test", "publishable_key": "pk_test"},
            headers=manager_auth_headers,
        )

    assert response.status_code == 502, response.text
    err = response.json()["detail"]["error"]
    assert err["code"] == "STRIPE_API_ERROR"


# ---------------------------------------------------------------------------
# GET /api/billing/settings — connected state
# ---------------------------------------------------------------------------


def test_get_settings_connected(client, manager_auth_headers, db_session, studio_settings):
    """After POST connects Stripe, GET returns expected shape."""
    mock_account = MagicMock()
    mock_account.id = "acct_get_test"

    with patch("stripe.Account.retrieve", return_value=mock_account):
        with patch("app.routers.stripe_billing._update_env_file"):
            post_resp = client.post(
                "/api/billing/settings",
                json={
                    "secret_key": "sk_test_get",
                    "publishable_key": "pk_test_get",
                },
                headers=manager_auth_headers,
            )
    assert post_resp.status_code == 200

    get_resp = client.get("/api/billing/settings", headers=manager_auth_headers)
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json()
    assert data["stripe_connected"] is True
    assert data["stripe_account_id"] == "acct_get_test"
    assert "publishable_key" in data
    # Secret key must never be returned
    assert "secret_key" not in data


# ---------------------------------------------------------------------------
# POST /api/billing/settings — unauthorized (no token)
# ---------------------------------------------------------------------------


def test_post_settings_unauthorized(client, studio_settings):
    """Request without auth token → 401/403."""
    response = client.post(
        "/api/billing/settings",
        json={"secret_key": "sk_test", "publishable_key": "pk_test"},
    )
    assert response.status_code in (401, 403), response.text
