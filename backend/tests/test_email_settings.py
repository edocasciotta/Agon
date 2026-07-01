"""
Tests for:
- GET/PUT /api/v1/studio/email
- POST /api/v1/studio/email/test
- POST /api/v1/clients (backoffice create)
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def studio_settings(db_session):
    """Create studio settings row so endpoints can find it."""
    from app.models.studio_settings import StudioSettings

    s = StudioSettings(
        id=1,
        studio_name="Test Studio",
        timezone="Europe/Rome",
        cancellation_hours=2,
        checkin_open_minutes_before=30,
        checkin_close_minutes_after=15,
        waitlist_confirm_minutes=30,
    )
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


# ---- Email settings ----


def test_get_email_settings_returns_defaults(client, manager_auth_headers, studio_settings):
    resp = client.get("/api/v1/studio/email", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "email_smtp_host" in data
    assert data["email_smtp_port"] == 587
    assert data["email_smtp_tls"] is True
    # Password not set → empty string
    assert data["email_smtp_password"] == ""


def test_save_email_settings(client, manager_auth_headers, studio_settings):
    payload = {
        "email_smtp_host": "smtp.gmail.com",
        "email_smtp_port": 465,
        "email_smtp_user": "info@studio.it",
        "email_smtp_password": "supersecret",
        "email_from_name": "Test Studio",
        "email_from_address": "info@studio.it",
        "email_smtp_tls": False,
    }
    resp = client.put("/api/v1/studio/email", json=payload, headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email_smtp_host"] == "smtp.gmail.com"
    assert data["email_smtp_port"] == 465
    assert data["email_smtp_user"] == "info@studio.it"
    assert data["email_smtp_password"] == "***"  # masked
    assert data["email_from_name"] == "Test Studio"
    assert data["email_from_address"] == "info@studio.it"
    assert data["email_smtp_tls"] is False

    # Verify GET also returns updated values
    resp2 = client.get("/api/v1/studio/email", headers=manager_auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["email_smtp_host"] == "smtp.gmail.com"
    assert resp2.json()["email_smtp_password"] == "***"


def test_send_test_email_smtp_not_configured(client, manager_auth_headers, studio_settings):
    """Should return 400 if SMTP not configured."""
    resp = client.post("/api/v1/studio/email/test", headers=manager_auth_headers)
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "SMTP_NOT_CONFIGURED"


def test_send_test_email_success(client, manager_auth_headers, studio_settings, db_session):
    """With SMTP configured and mocked send, should return 200."""
    studio_settings.email_smtp_host = "smtp.gmail.com"
    studio_settings.email_from_address = "info@studio.it"
    db_session.commit()

    with patch("app.services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = None
        resp = client.post("/api/v1/studio/email/test", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert "Test email sent" in resp.json()["message"]


# ---- POST /api/v1/clients ----


def test_create_client_from_backoffice(client, manager_auth_headers, studio_settings):
    """Manager can create a client; email_sent reflects send result."""
    with patch("app.services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = None
        resp = client.post(
            "/api/v1/clients",
            json={
                "full_name": "New Client",
                "email": "newclient@example.com",
                "phone": "+39123456789",
            },
            headers=manager_auth_headers,
        )
    # email will fail because SMTP host not properly set → email_sent = False but 201 returned
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newclient@example.com"
    assert data["full_name"] == "New Client"
    assert "email_sent" in data


def test_create_client_from_backoffice_email_sent_true(
    client, manager_auth_headers, studio_settings, db_session
):
    """When SMTP is configured, email_sent should be True."""
    studio_settings.email_smtp_host = "smtp.example.com"
    studio_settings.email_from_address = "noreply@example.com"
    db_session.commit()

    with patch("app.services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = None
        resp = client.post(
            "/api/v1/clients",
            json={"full_name": "Jane Doe", "email": "jane@example.com"},
            headers=manager_auth_headers,
        )
    assert resp.status_code == 201
    assert resp.json()["email_sent"] is True


def test_create_client_duplicate_email(
    client, manager_auth_headers, studio_settings, registered_client
):
    """Creating a client with an existing email returns 409."""
    resp = client.post(
        "/api/v1/clients",
        json={"full_name": "Duplicate", "email": "test@example.com"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "CLIENT_EMAIL_ALREADY_EXISTS"


def test_create_client_requires_manager(client, client_auth_headers, studio_settings):
    """Regular client cannot create other clients."""
    resp = client.post(
        "/api/v1/clients",
        json={"full_name": "New", "email": "new2@example.com"},
        headers=client_auth_headers,
    )
    assert resp.status_code in (401, 403)


# ---- forgot-password / reset-password ----


def test_forgot_password_unknown_email_returns_200(client, studio_settings):
    """Even if email does not exist, returns 200 (no info leak)."""
    resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert resp.status_code == 200
    assert "reset link" in resp.json()["message"]


def test_reset_password_flow(client, studio_settings, db_session):
    """Full flow: register client → forgot-password → extract token → reset → login."""
    from app.models.client import Client
    from app.models.invitation_token import InvitationToken

    # Register a client
    resp = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": "resetme@example.com",
            "password": "oldpassword1",
            "full_name": "Reset Me",
        },
    )
    assert resp.status_code == 201

    # Request reset
    with patch("app.services.email_service.aiosmtplib.send", new_callable=AsyncMock):
        resp2 = client.post("/api/v1/auth/forgot-password", json={"email": "resetme@example.com"})
    assert resp2.status_code == 200

    # Get the token from the DB
    client_obj = db_session.query(Client).filter_by(email="resetme@example.com").first()
    inv = (
        db_session.query(InvitationToken)
        .filter_by(client_id=client_obj.id)
        .order_by(InvitationToken.id.desc())
        .first()
    )
    assert inv is not None
    token_str = inv.token

    # Reset password
    resp3 = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token_str,
            "new_password": "newpassword99",
        },
    )
    assert resp3.status_code == 200
    assert resp3.json()["message"] == "Password updated"

    # Verify old password no longer works
    resp4 = client.post(
        "/api/v1/auth/login", json={"email": "resetme@example.com", "password": "oldpassword1"}
    )
    assert resp4.status_code == 401

    # Verify new password works
    resp5 = client.post(
        "/api/v1/auth/login", json={"email": "resetme@example.com", "password": "newpassword99"}
    )
    assert resp5.status_code == 200


def test_reset_password_token_not_found(client, studio_settings):
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": "nonexistent-token",
            "new_password": "newpassword99",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "RESET_TOKEN_NOT_FOUND"


def test_reset_password_too_short(client, studio_settings, db_session):
    """Short password rejected even with valid token."""
    from datetime import timedelta

    from app.models.client import Client
    from app.models.invitation_token import InvitationToken
    from app.utils import utcnow

    c = Client(email="short@example.com", password_hash="x", full_name="Short")
    db_session.add(c)
    db_session.flush()
    inv = InvitationToken(
        client_id=c.id, token="short-token-abc", expires_at=utcnow() + timedelta(hours=1)
    )
    db_session.add(inv)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": "short-token-abc",
            "new_password": "abc",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "AUTH_PASSWORD_TOO_SHORT"


def test_reset_password_token_already_used(client, studio_settings, db_session):
    from datetime import timedelta

    from app.models.client import Client
    from app.models.invitation_token import InvitationToken
    from app.utils import utcnow

    c = Client(email="used@example.com", password_hash="x", full_name="Used")
    db_session.add(c)
    db_session.flush()
    inv = InvitationToken(
        client_id=c.id, token="used-token-xyz", used=True, expires_at=utcnow() + timedelta(hours=1)
    )
    db_session.add(inv)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": "used-token-xyz",
            "new_password": "validpass99",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "RESET_TOKEN_ALREADY_USED"
