"""IDOR and role-based access control tests.

Each test verifies that the wrong actor cannot read, mutate, or enumerate
data it does not own or lacks the privilege to access.
"""

import pytest
from app.auth import hash_password
from app.models.booking import Booking
from app.models.user import User

# ── Extra fixtures ────────────────────────────────────────────────────────────


@pytest.fixture
def client_b_headers(client):
    """Auth token for a second registered client (Client B)."""
    resp = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": "clientb@example.com",
            "password": "passwordB123",
            "full_name": "Client B",
        },
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def instructor_headers(client, db_session):
    """Auth token for an instructor user."""
    u = User(
        email="instructor@test.com",
        password_hash=hash_password("instpass123"),
        full_name="Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "instructor@test.com", "password": "instpass123"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def booking_for_client_a(db_session, registered_client, client_membership, scheduled_class_fixture):
    """A confirmed booking owned by Client A."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    b = Booking(
        client_id=client_a.id,
        scheduled_class_id=scheduled_class_fixture.id,
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


# ── IDOR: booking ownership ────────────────────────────────────────────────────


def test_client_b_cannot_read_client_a_booking(client, booking_for_client_a, client_b_headers):
    """Client B must receive 403 when reading Client A's booking."""
    resp = client.get(f"/api/v1/bookings/{booking_for_client_a.id}", headers=client_b_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_b_cannot_cancel_client_a_booking(client, booking_for_client_a, client_b_headers):
    """Client B must receive 403 when cancelling Client A's booking."""
    resp = client.delete(f"/api/v1/bookings/{booking_for_client_a.id}", headers=client_b_headers)
    assert resp.status_code == 403


# ── Role enforcement: client cannot use backoffice endpoints ──────────────────


def test_client_cannot_list_all_clients(client, client_auth_headers):
    """Client role must not enumerate the full client roster."""
    resp = client.get("/api/v1/clients", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_view_another_client_profile(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    """Client role must not read another client's profile by ID."""
    # Create a second client via the manager
    resp = client.post(
        "/api/v1/clients",
        json={"email": "other@client.com", "full_name": "Other Client"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    other_id = resp.json()["id"]

    resp = client.get(f"/api/v1/clients/{other_id}", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_create_class_template(client, client_auth_headers):
    """Client must not be able to create class templates."""
    resp = client.post(
        "/api/v1/class-templates",
        json={
            "name": "Unauthorized Yoga",
            "duration_minutes": 60,
            "default_capacity": 20,
            "color": "#000000",
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_update_studio_settings(client, client_auth_headers):
    """Client must not be able to modify studio settings."""
    resp = client.put(
        "/api/v1/studio",
        json={"studio_name": "Hacked Studio"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_view_client_bookings_by_id(client, client_b_headers, booking_for_client_a):
    """Client must not be able to read another client's booking list via /clients/{id}/bookings."""
    resp = client.get(
        f"/api/v1/clients/{booking_for_client_a.client_id}/bookings",
        headers=client_b_headers,
    )
    assert resp.status_code == 403


# ── Role enforcement: instructor cannot manage studio ─────────────────────────


def test_instructor_cannot_update_studio_settings(client, instructor_headers):
    """Instructor must not be able to modify studio settings."""
    resp = client.put(
        "/api/v1/studio",
        json={"studio_name": "Instructor Hack"},
        headers=instructor_headers,
    )
    assert resp.status_code == 403


def test_instructor_cannot_create_class_template(client, instructor_headers):
    """Instructor must not be able to create class templates."""
    resp = client.post(
        "/api/v1/class-templates",
        json={
            "name": "Instructor Pilates",
            "duration_minutes": 45,
            "default_capacity": 10,
            "color": "#000000",
        },
        headers=instructor_headers,
    )
    assert resp.status_code == 403


# ── Unauthenticated access ────────────────────────────────────────────────────


# ── Role enforcement: no-show endpoint ──────────────────────────────────────


def test_client_cannot_mark_no_show(client, booking_for_client_a, client_auth_headers):
    """Client role must not be able to mark a booking as no-show (manager-only)."""
    resp = client.post(
        f"/api/v1/bookings/{booking_for_client_a.id}/no-show",
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_instructor_cannot_mark_no_show(client, booking_for_client_a, instructor_headers):
    """Instructor role must not be able to mark a booking as no-show (manager-only)."""
    resp = client.post(
        f"/api/v1/bookings/{booking_for_client_a.id}/no-show",
        headers=instructor_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


# ── Unauthenticated access ────────────────────────────────────────────────────


# ── Role enforcement: promo codes CRUD ────────────────────────────────────


def test_client_cannot_list_promo_codes(client, client_auth_headers):
    """Client role must not be able to list promo codes (manager-only)."""
    resp = client.get("/api/v1/promo-codes", headers=client_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_create_promo_codes(client, client_auth_headers):
    """Client role must not be able to create promo codes (manager-only)."""
    from app.utils import utcnow

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
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_instructor_cannot_create_promo_codes(client, instructor_headers):
    """Instructor role must not be able to create promo codes (manager-only)."""
    from app.utils import utcnow

    now = utcnow()
    resp = client.post(
        "/api/v1/promo-codes",
        json={
            "code": "HACK",
            "discount_type": "percentage",
            "discount_value": 100.0,
            "valid_from": now.isoformat(),
        },
        headers=instructor_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


# ── Unauthenticated access ────────────────────────────────────────────────────


# ── Role enforcement: gift cards CRUD ─────────────────────────────────────────


def test_client_cannot_list_gift_cards(client, client_auth_headers):
    """Client role must not be able to list gift cards (manager-only)."""
    resp = client.get("/api/v1/gift-cards", headers=client_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_issue_gift_cards(client, client_auth_headers):
    """Client role must not be able to manually issue gift cards (manager-only)."""
    resp = client.post(
        "/api/v1/gift-cards",
        json={"initial_value": 100.0},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_deactivate_gift_cards(client, client_auth_headers, db_session):
    """Client role must not be able to deactivate gift cards (manager-only)."""
    from app.models.gift_card import GiftCard

    gc = GiftCard(code="GC-IDORTEST", initial_value=10.0, remaining_balance=10.0, is_active=True)
    db_session.add(gc)
    db_session.commit()
    db_session.refresh(gc)

    resp = client.delete(f"/api/v1/gift-cards/{gc.id}", headers=client_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_instructor_cannot_issue_gift_cards(client, instructor_headers):
    """Instructor role must not be able to manually issue gift cards (manager-only)."""
    resp = client.post(
        "/api/v1/gift-cards",
        json={"initial_value": 100.0},
        headers=instructor_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_can_validate_gift_card_without_ownership(client, client_auth_headers, db_session):
    """Gift card codes are not client-scoped (unlike client data) — any
    authenticated client may validate a code that was issued to someone else,
    since validation is a read-only check needed before a purchase, not an
    access to another client's private data.
    """
    from app.models.gift_card import GiftCard

    gc = GiftCard(
        code="GC-SHAREABLE",
        initial_value=20.0,
        remaining_balance=20.0,
        is_active=True,
        recipient_name="Someone Else",
    )
    db_session.add(gc)
    db_session.commit()

    resp = client.post(
        "/api/v1/gift-cards/validate",
        json={"code": "GC-SHAREABLE"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_unauthenticated_cannot_validate_gift_card(client, db_session):
    """Gift card validation still requires authentication."""
    from app.models.gift_card import GiftCard

    gc = GiftCard(code="GC-NOAUTH01", initial_value=10.0, remaining_balance=10.0, is_active=True)
    db_session.add(gc)
    db_session.commit()

    resp = client.post("/api/v1/gift-cards/validate", json={"code": "GC-NOAUTH01"})
    assert resp.status_code == 401


# ── IDOR: Tags ───────────────────────────────────────────────────────────────


def test_client_cannot_assign_tags(client, client_auth_headers, registered_client, db_session):
    """Client role must not be able to assign tags (manager-only)."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.post(
        f"/api/v1/clients/{client_obj.id}/tags",
        json={"tag_id": 1},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_remove_tags(client, client_auth_headers, registered_client, db_session):
    """Client role must not be able to remove tags (manager-only)."""
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.delete(
        f"/api/v1/clients/{client_obj.id}/tags/1",
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_manage_auto_tag_rules(client, client_auth_headers):
    """Client role must not be able to manage auto-tag rules (manager-only)."""
    resp = client.get("/api/v1/auto-tag-rules", headers=client_auth_headers)
    assert resp.status_code == 403

    resp = client.post(
        "/api/v1/auto-tag-rules",
        json={"tag_id": 1, "trigger_event": "booking_created"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_create_tags(client, client_auth_headers):
    """Client role must not be able to create tags (manager-only)."""
    resp = client.post(
        "/api/v1/tags",
        json={"name": "Hacked"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_view_other_client_tags(
    client, client_auth_headers, client_b_headers, registered_client, db_session
):
    """Client B must not be able to see Client A's tags."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.get(
        f"/api/v1/clients/{client_a.id}/tags",
        headers=client_b_headers,
    )
    assert resp.status_code == 403


def test_unauthenticated_cannot_list_bookings(client):
    resp = client.get("/api/v1/bookings")
    assert resp.status_code == 401


def test_unauthenticated_cannot_list_clients(client):
    resp = client.get("/api/v1/clients")
    assert resp.status_code == 401


def test_unauthenticated_cannot_read_studio_settings(client):
    resp = client.get("/api/v1/studio")
    assert resp.status_code == 401


# ── IDOR / role checks: SMS (manager-only surface, no client-facing access) ──


def test_client_cannot_read_sms_settings(client, client_auth_headers):
    resp = client.get("/api/v1/sms/settings", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_update_sms_settings(client, client_auth_headers):
    resp = client.put(
        "/api/v1/sms/settings",
        json={"enabled": True},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_test_send_sms(client, client_auth_headers):
    resp = client.post(
        "/api/v1/sms/settings/test",
        json={"to_phone": "+15005550001"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_list_sms_templates(client, client_auth_headers):
    resp = client.get("/api/v1/sms/templates", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_create_sms_template(client, client_auth_headers):
    resp = client.post(
        "/api/v1/sms/templates",
        json={"name": "Hacked", "body": "hi"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_update_sms_template(client, client_auth_headers):
    resp = client.put(
        "/api/v1/sms/templates/1",
        json={"name": "Hacked"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_delete_sms_template(client, client_auth_headers):
    resp = client.delete("/api/v1/sms/templates/1", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_list_sms_event_assignments(client, client_auth_headers):
    resp = client.get("/api/v1/sms/events", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_assign_sms_event_template(client, client_auth_headers):
    resp = client.put(
        "/api/v1/sms/events/client_invite",
        json={"template_id": None},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_send_manual_sms(client, client_auth_headers):
    """Client role must not be able to send a manual SMS to any client (manager-only)."""
    resp = client.post(
        "/api/v1/sms/send",
        json={"client_id": 1, "body": "Hacked"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_unauthenticated_cannot_read_sms_settings(client):
    resp = client.get("/api/v1/sms/settings")
    assert resp.status_code == 401


def test_unauthenticated_cannot_send_manual_sms(client):
    resp = client.post("/api/v1/sms/send", json={"client_id": 1, "body": "hi"})
    assert resp.status_code == 401


# ── IDOR: Calendar Sync ──────────────────────────────────────────────────────


def test_client_b_cannot_get_client_a_calendar_sync(
    client, client_auth_headers, client_b_headers, registered_client, db_session
):
    """Client B must receive 403 when fetching Client A's calendar-sync feed URL."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.get(f"/api/v1/clients/{client_a.id}/calendar-sync", headers=client_b_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "FORBIDDEN"


def test_client_b_cannot_regenerate_client_a_calendar_sync(
    client, client_auth_headers, client_b_headers, registered_client, db_session
):
    """Client B must receive 403 when regenerating Client A's calendar-sync token."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    # Client A creates a token first so there is something to regenerate.
    client.get(f"/api/v1/clients/{client_a.id}/calendar-sync", headers=client_auth_headers)

    resp = client.post(
        f"/api/v1/clients/{client_a.id}/calendar-sync/regenerate", headers=client_b_headers
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "FORBIDDEN"


def test_client_a_can_get_and_regenerate_own_calendar_sync(
    client, client_auth_headers, registered_client, db_session
):
    """A client CAN fetch and regenerate their own calendar-sync URL (not 403)."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    resp = client.get(f"/api/v1/clients/{client_a.id}/calendar-sync", headers=client_auth_headers)
    assert resp.status_code == 200

    resp = client.post(
        f"/api/v1/clients/{client_a.id}/calendar-sync/regenerate", headers=client_auth_headers
    )
    assert resp.status_code == 200


def test_manager_can_get_any_client_calendar_sync(
    client, manager_auth_headers, registered_client, db_session
):
    """Managers may access any client's calendar-sync URL (staff scope)."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.get(f"/api/v1/clients/{client_a.id}/calendar-sync", headers=manager_auth_headers)
    assert resp.status_code == 200


# ── IDOR: waivers ────────────────────────────────────────────────────────────


def _create_waiver_as_manager(client, manager_auth_headers, **overrides):
    payload = {
        "title": "Liability Waiver",
        "body": "I assume all risk.",
        "requires_before_booking": False,
    }
    payload.update(overrides)
    resp = client.post("/api/v1/waivers", json=payload, headers=manager_auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_client_b_cannot_view_client_a_waivers(
    client, client_b_headers, registered_client, db_session
):
    """Client B must receive 403 when listing Client A's waiver status."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.get(f"/api/v1/clients/{client_a.id}/waivers", headers=client_b_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "FORBIDDEN"


def test_client_a_can_view_own_waivers(client, client_auth_headers, registered_client, db_session):
    """A client CAN view their own waiver status (not 403)."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.get(f"/api/v1/clients/{client_a.id}/waivers", headers=client_auth_headers)
    assert resp.status_code == 200


def test_client_cannot_create_waiver(client, client_auth_headers):
    """Client must not be able to create a waiver (manager-only CRUD)."""
    resp = client.post(
        "/api/v1/waivers",
        json={"title": "Unauthorized", "body": "Nope"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_list_waivers_backoffice_endpoint(client, client_auth_headers):
    """Client must not be able to hit the manager-only GET /waivers list."""
    resp = client.get("/api/v1/waivers", headers=client_auth_headers)
    assert resp.status_code == 403


def test_client_cannot_update_waiver(client, client_auth_headers, manager_auth_headers):
    """Client must not be able to update a waiver (manager-only CRUD)."""
    created = _create_waiver_as_manager(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"title": "Hacked"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_client_cannot_deactivate_waiver(client, client_auth_headers, manager_auth_headers):
    """Client must not be able to deactivate a waiver (manager-only CRUD)."""
    created = _create_waiver_as_manager(client, manager_auth_headers)
    resp = client.delete(f"/api/v1/waivers/{created['id']}", headers=client_auth_headers)
    assert resp.status_code == 403


def test_instructor_cannot_create_waiver(client, instructor_headers):
    """Instructor role must not be able to author waivers (manager-only)."""
    resp = client.post(
        "/api/v1/waivers",
        json={"title": "Unauthorized", "body": "Nope"},
        headers=instructor_headers,
    )
    assert resp.status_code == 403


def test_unauthenticated_cannot_sign_waiver(client, manager_auth_headers):
    """The sign endpoint requires a valid access token."""
    created = _create_waiver_as_manager(client, manager_auth_headers)
    resp = client.post(f"/api/v1/waivers/{created['id']}/sign", json={"signed_name": "Nobody"})
    assert resp.status_code == 401


def test_manager_cannot_sign_waiver_on_clients_behalf(client, manager_auth_headers):
    """A manager token must be rejected by the client-only sign endpoint."""
    created = _create_waiver_as_manager(client, manager_auth_headers)
    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Manager Impersonating"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 403


def test_instructor_cannot_sign_waiver_on_clients_behalf(
    client, instructor_headers, manager_auth_headers
):
    """An instructor token must also be rejected by the client-only sign endpoint."""
    created = _create_waiver_as_manager(client, manager_auth_headers)
    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Instructor Impersonating"},
        headers=instructor_headers,
    )
    assert resp.status_code == 403


# ── IDOR: appointments ──────────────────────────────────────────────────────


@pytest.fixture
def appointment_for_client_a(db_session, registered_client):
    """A confirmed appointment owned by Client A, with its own service/instructor."""
    import datetime

    from app.models.appointment import Appointment
    from app.models.appointment_service import AppointmentService
    from app.models.client import Client
    from app.models.instructor import Instructor

    instructor_user = User(
        email="idor-appt-instructor@test.com",
        password_hash=hash_password("instpass123"),
        full_name="IDOR Test Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor_user)
    db_session.commit()
    instructor = Instructor(user_id=instructor_user.id)
    db_session.add(instructor)

    service = AppointmentService(name="PT Session", duration_minutes=60, is_active=True)
    db_session.add(service)
    db_session.commit()
    db_session.refresh(instructor)
    db_session.refresh(service)

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    future = datetime.datetime.utcnow() + datetime.timedelta(days=3)
    appt = Appointment(
        service_id=service.id,
        instructor_id=instructor.id,
        client_id=client_a.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(appt)
    db_session.commit()
    db_session.refresh(appt)
    return appt


def test_client_b_cannot_read_client_a_appointment(
    client, appointment_for_client_a, client_b_headers
):
    """Client B must receive 403 when reading Client A's appointment."""
    resp = client.get(
        f"/api/v1/appointments/{appointment_for_client_a.id}", headers=client_b_headers
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_b_cannot_cancel_client_a_appointment(
    client, appointment_for_client_a, client_b_headers
):
    """Client B must receive 403 when cancelling Client A's appointment."""
    resp = client.patch(
        f"/api/v1/appointments/{appointment_for_client_a.id}/cancel", headers=client_b_headers
    )
    assert resp.status_code == 403


def test_client_a_can_read_own_appointment(client, appointment_for_client_a, client_auth_headers):
    """A client CAN read their own appointment (not 403)."""
    resp = client.get(
        f"/api/v1/appointments/{appointment_for_client_a.id}", headers=client_auth_headers
    )
    assert resp.status_code == 200


def test_client_cannot_book_appointment_for_another_client(client, client_auth_headers):
    """A client passing a client_id that is not their own must be rejected (mixed-audience IDOR)."""
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": 1,
            "instructor_id": 1,
            "starts_at": "2030-01-01T10:00:00",
            "client_id": 999999,
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_complete_appointment(client, appointment_for_client_a, client_auth_headers):
    """Client role must not be able to mark an appointment completed/no-show (staff-only)."""
    resp = client.patch(
        f"/api/v1/appointments/{appointment_for_client_a.id}/complete",
        json={"status": "completed"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_create_appointment_service(client, client_auth_headers):
    """Client must not be able to create appointment services (manager-only)."""
    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Unauthorized Massage", "duration_minutes": 60},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_instructor_cannot_manage_another_instructors_availability(
    client, db_session, instructor_headers
):
    """An instructor must not be able to create availability for a different instructor."""
    from app.models.instructor import Instructor

    other_user = User(
        email="idor-other-instructor@test.com",
        password_hash=hash_password("otherpass123"),
        full_name="Other Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.commit()
    other_instructor = Instructor(user_id=other_user.id)
    db_session.add(other_instructor)
    db_session.commit()
    db_session.refresh(other_instructor)

    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": other_instructor.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
        },
        headers=instructor_headers,
    )
    assert resp.status_code == 403
