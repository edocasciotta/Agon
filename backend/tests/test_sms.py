"""
Tests for:
- SMS Templates CRUD  (GET/POST/PUT/DELETE /api/v1/sms/templates)
- SMS Event Assignments  (GET/PUT /api/v1/sms/events)
- SMS Settings  (GET/PUT /api/v1/sms/settings, POST /api/v1/sms/settings/test)
- Manual one-off SMS  (POST /api/v1/sms/send)
- send_event_sms template-found vs. fallback-generic-message branches
"""

from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


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


@pytest.fixture
def sms_configured_settings(studio_settings, db_session):
    """Studio settings with a fully configured (fake) Twilio account."""
    studio_settings.sms_provider_account_sid = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    studio_settings.sms_provider_auth_token = "faketoken1234"
    studio_settings.sms_from_number = "+15005550006"
    studio_settings.sms_enabled = True
    db_session.commit()
    db_session.refresh(studio_settings)
    return studio_settings


def _create_template(client, manager_auth_headers, name="Welcome EN", body="Hi {{client_name}}!"):
    resp = client.post(
        "/api/v1/sms/templates",
        json={"name": name, "body": body},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


def _mock_twilio_client():
    """Return a MagicMock standing in for twilio.rest.Client with a working .messages.create."""
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(sid="SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    return mock_client


# ---------------------------------------------------------------------------
# SMS Templates CRUD
# ---------------------------------------------------------------------------


def test_list_templates_empty(client, manager_auth_headers):
    resp = client.get("/api/v1/sms/templates", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_template(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/sms/templates",
        json={
            "name": "Booking Confirmed IT",
            "body": "Ciao {{client_name}}, la tua prenotazione è confermata!",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Booking Confirmed IT"
    assert data["body"] == "Ciao {{client_name}}, la tua prenotazione è confermata!"
    assert "id" in data
    assert "created_at" in data


def test_get_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.get(f"/api/v1/sms/templates/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]
    assert resp.json()["body"] == created["body"]


def test_get_template_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/sms/templates/9999", headers=manager_auth_headers)
    assert resp.status_code == 404


def test_update_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/sms/templates/{created['id']}",
        json={"name": "Updated Name"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    # body should be unchanged
    assert data["body"] == created["body"]


def test_delete_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.delete(f"/api/v1/sms/templates/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    # Confirm it's gone
    resp2 = client.get(f"/api/v1/sms/templates/{created['id']}", headers=manager_auth_headers)
    assert resp2.status_code == 404


def test_delete_template_assigned_returns_409(client, manager_auth_headers):
    """Deleting a template that is currently assigned to an event returns 409."""
    created = _create_template(client, manager_auth_headers)

    assign_resp = client.put(
        "/api/v1/sms/events/client_invite",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )
    assert assign_resp.status_code == 200

    del_resp = client.delete(f"/api/v1/sms/templates/{created['id']}", headers=manager_auth_headers)
    assert del_resp.status_code == 409
    assert del_resp.json()["detail"]["error"]["code"] == "TEMPLATE_IN_USE"


# ---------------------------------------------------------------------------
# SMS Event Assignments
# ---------------------------------------------------------------------------


def test_get_event_assignments_all_types(client, manager_auth_headers):
    """All 7 event types (shared with email's EVENT_TYPES) should appear."""
    resp = client.get("/api/v1/sms/events", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    event_types = [item["event_type"] for item in data]
    expected = [
        "client_invite",
        "password_reset",
        "booking_confirmed",
        "booking_cancelled",
        "class_reminder",
        "membership_expiring",
        "waitlist_promoted",
    ]
    for et in expected:
        assert et in event_types
    assert len(data) == 7


def test_get_event_assignments_unassigned_by_default(client, manager_auth_headers):
    resp = client.get("/api/v1/sms/events", headers=manager_auth_headers)
    assert resp.status_code == 200
    for item in resp.json():
        assert item["template"] is None


def test_assign_template_to_event(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)

    resp = client.put(
        "/api/v1/sms/events/booking_confirmed",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_type"] == "booking_confirmed"
    assert data["template"]["id"] == created["id"]
    assert data["template"]["name"] == created["name"]

    list_resp = client.get("/api/v1/sms/events", headers=manager_auth_headers)
    booking_event = next(
        item for item in list_resp.json() if item["event_type"] == "booking_confirmed"
    )
    assert booking_event["template"]["id"] == created["id"]


def test_unassign_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)

    client.put(
        "/api/v1/sms/events/class_reminder",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )
    resp = client.put(
        "/api/v1/sms/events/class_reminder",
        json={"template_id": None},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["template"] is None


def test_assign_invalid_event_type(client, manager_auth_headers):
    resp = client.put(
        "/api/v1/sms/events/nonexistent_event",
        json={"template_id": None},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


def test_assign_nonexistent_template(client, manager_auth_headers):
    resp = client.put(
        "/api/v1/sms/events/client_invite",
        json={"template_id": 9999},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# SMS Settings
# ---------------------------------------------------------------------------


def test_get_sms_settings_returns_defaults(client, manager_auth_headers, studio_settings):
    resp = client.get("/api/v1/sms/settings", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sms_enabled"] is False
    assert data["sms_provider_auth_token"] == ""
    assert data["sms_provider_account_sid"] is None


def test_save_sms_settings_masks_auth_token(client, manager_auth_headers, studio_settings):
    payload = {
        "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "auth_token": "supersecrettoken1234",
        "from_number": "+15005550006",
        "enabled": True,
    }
    resp = client.put("/api/v1/sms/settings", json=payload, headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sms_provider_account_sid"] == "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    assert data["sms_from_number"] == "+15005550006"
    assert data["sms_enabled"] is True
    # Auth token must never come back in full — only a masked last-4 form
    assert data["sms_provider_auth_token"] != "supersecrettoken1234"
    assert data["sms_provider_auth_token"].endswith("1234")
    assert "supersecrettoken" not in data["sms_provider_auth_token"]

    # GET also returns the masked value, never the raw secret
    resp2 = client.get("/api/v1/sms/settings", headers=manager_auth_headers)
    assert resp2.status_code == 200
    assert "supersecrettoken" not in resp2.text


def test_save_sms_settings_partial_update(client, manager_auth_headers, sms_configured_settings):
    """PUT with only some fields should not clobber the others."""
    resp = client.put(
        "/api/v1/sms/settings",
        json={"enabled": False},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sms_enabled"] is False
    # Untouched fields survive
    assert data["sms_from_number"] == "+15005550006"


def test_send_test_sms_not_configured(client, manager_auth_headers, studio_settings):
    """Should return 503 if Twilio not configured / sms_enabled=False."""
    resp = client.post(
        "/api/v1/sms/settings/test",
        json={"to_phone": "+15005550001"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "SMS_NOT_CONFIGURED"


def test_send_test_sms_success(client, manager_auth_headers, sms_configured_settings):
    """With Twilio configured and mocked, test send should return 200."""
    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client_cls.return_value = _mock_twilio_client()
        resp = client.post(
            "/api/v1/sms/settings/test",
            json={"to_phone": "+15005550001"},
            headers=manager_auth_headers,
        )
    assert resp.status_code == 200
    assert "Test SMS sent" in resp.json()["message"]


def test_send_test_sms_twilio_failure_returns_502(
    client, manager_auth_headers, sms_configured_settings
):
    """Twilio API raising TwilioRestException should surface as SMS_SEND_FAILED (502)."""
    from twilio.base.exceptions import TwilioRestException

    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = TwilioRestException(
            status=400, uri="/Messages", msg="Invalid 'To' Phone Number"
        )
        mock_client_cls.return_value = mock_client
        resp = client.post(
            "/api/v1/sms/settings/test",
            json={"to_phone": "not-a-phone"},
            headers=manager_auth_headers,
        )
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"]["code"] == "SMS_SEND_FAILED"


def test_sms_settings_requires_manager(client, client_auth_headers, studio_settings):
    resp = client.get("/api/v1/sms/settings", headers=client_auth_headers)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Manual one-off SMS — POST /api/v1/sms/send
# ---------------------------------------------------------------------------


def test_manual_send_sms_success(
    client, manager_auth_headers, sms_configured_settings, db_session, registered_client
):
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    client_obj.phone = "+15005550010"
    db_session.commit()

    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client_cls.return_value = _mock_twilio_client()
        resp = client.post(
            "/api/v1/sms/send",
            json={"client_id": client_obj.id, "body": "Hey, your class starts soon!"},
            headers=manager_auth_headers,
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"


def test_manual_send_sms_client_no_phone(
    client, manager_auth_headers, sms_configured_settings, db_session, registered_client
):
    """Client with no phone on file returns 400 CLIENT_NO_PHONE."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    assert client_obj.phone is None

    resp = client.post(
        "/api/v1/sms/send",
        json={"client_id": client_obj.id, "body": "Hello"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "CLIENT_NO_PHONE"


def test_manual_send_sms_not_configured(
    client, manager_auth_headers, studio_settings, db_session, registered_client
):
    """SMS not configured (sms_enabled=False) returns 503 SMS_NOT_CONFIGURED."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    client_obj.phone = "+15005550010"
    db_session.commit()

    resp = client.post(
        "/api/v1/sms/send",
        json={"client_id": client_obj.id, "body": "Hello"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "SMS_NOT_CONFIGURED"


def test_manual_send_sms_client_not_found(client, manager_auth_headers, sms_configured_settings):
    resp = client.post(
        "/api/v1/sms/send",
        json={"client_id": 999999, "body": "Hello"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


def test_manual_send_sms_requires_manager(client, client_auth_headers, sms_configured_settings):
    """Client role must not be able to send manual SMS (manager-only)."""
    resp = client.post(
        "/api/v1/sms/send",
        json={"client_id": 1, "body": "Hacked"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# send_event_sms — template-found vs. fallback-generic-message branches
# ---------------------------------------------------------------------------


def test_send_event_sms_uses_assigned_template(db_session, sms_configured_settings):
    """When a template is assigned to the event, its {{key}} placeholders are rendered."""
    from app.models.sms_event_assignment import SmsEventAssignment
    from app.models.sms_template import SmsTemplate
    from app.services.sms_service import send_event_sms

    tmpl = SmsTemplate(name="Invite", body="Hi {{client_name}}, join us at {{studio_name}}!")
    db_session.add(tmpl)
    db_session.commit()
    db_session.refresh(tmpl)

    assignment = SmsEventAssignment(event_type="client_invite", template_id=tmpl.id)
    db_session.add(assignment)
    db_session.commit()

    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client = _mock_twilio_client()
        mock_client_cls.return_value = mock_client
        send_event_sms(
            db_session,
            "client_invite",
            "+15005550010",
            {"client_name": "Jane", "studio_name": "Test Studio"},
        )

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["body"] == "Hi Jane, join us at Test Studio!"
    assert call_kwargs["to"] == "+15005550010"


def test_send_event_sms_falls_back_to_generic_message(db_session, sms_configured_settings):
    """When no template is assigned for the event, a minimal generic message is sent."""
    from app.services.sms_service import send_event_sms

    # No SmsEventAssignment row exists for this event type at all.
    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client = _mock_twilio_client()
        mock_client_cls.return_value = mock_client
        send_event_sms(
            db_session,
            "booking_confirmed",
            "+15005550010",
            {"class_name": "Yoga", "starts_at": "2026-07-11T09:00:00"},
        )

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert "class_name: Yoga" in call_kwargs["body"]
    assert "starts_at: 2026-07-11T09:00:00" in call_kwargs["body"]


def test_send_event_sms_assignment_exists_but_unassigned_falls_back(
    db_session, sms_configured_settings
):
    """An SmsEventAssignment row with template_id=None also falls back to generic message."""
    from app.models.sms_event_assignment import SmsEventAssignment
    from app.services.sms_service import send_event_sms

    assignment = SmsEventAssignment(event_type="waitlist_promoted", template_id=None)
    db_session.add(assignment)
    db_session.commit()

    with patch("app.services.sms_service.Client") as mock_client_cls:
        mock_client = _mock_twilio_client()
        mock_client_cls.return_value = mock_client
        send_event_sms(db_session, "waitlist_promoted", "+15005550010", {"client_name": "Jane"})

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert "client_name: Jane" in call_kwargs["body"]


def test_send_event_sms_not_configured_raises(db_session, studio_settings):
    """send_event_sms propagates ValueError when SMS is not enabled/configured."""
    from app.services.sms_service import send_event_sms

    with pytest.raises(ValueError):
        send_event_sms(db_session, "client_invite", "+15005550010", {"client_name": "Jane"})
