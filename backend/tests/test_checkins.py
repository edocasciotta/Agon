"""Tests for the check-in system (Phase 4)."""
import datetime
import pytest


# ---------------------------------------------------------------------------
# Local fixtures: class with check-in window open (starts in 10 min)
# ---------------------------------------------------------------------------

@pytest.fixture
def checkin_window_open_class(db_session):
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass

    tmpl = ClassTemplate(
        name="CheckinClass",
        duration_minutes=60,
        default_capacity=10,
        color="#000000",
        is_active=True,
    )
    db_session.add(tmpl)
    db_session.commit()

    # starts in 10 minutes — within default 15-min open window
    soon = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=soon,
        ends_at=soon + datetime.timedelta(hours=1),
        capacity=10,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.commit()
    db_session.refresh(sc)
    return sc


@pytest.fixture
def confirmed_booking_open_window(db_session, registered_client, client_membership, checkin_window_open_class):
    from app.models.booking import Booking
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    b = Booking(
        client_id=client_obj.id,
        scheduled_class_id=checkin_window_open_class.id,
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


# ---------------------------------------------------------------------------
# Test 1: Generate QR code (owner)
# ---------------------------------------------------------------------------

def test_generate_qr_code(client, confirmed_booking, client_auth_headers):
    response = client.get(
        f"/api/v1/checkins/qr/{confirmed_booking.id}",
        headers=client_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "qr_token" in data
    assert "qr_image_base64" in data
    assert data["booking_id"] == confirmed_booking.id
    assert len(data["qr_image_base64"]) > 0


# ---------------------------------------------------------------------------
# Test 2: Generate QR code forbidden for a different client
# ---------------------------------------------------------------------------

def test_generate_qr_code_forbidden(client, db_session, confirmed_booking, manager_user):
    """A different client cannot get the QR for someone else's booking."""
    from app.models.client import Client
    from app.auth import hash_password

    # Create a second client
    other_client = Client(
        email="other@example.com",
        password_hash=hash_password("otherpass123"),
        full_name="Other Client",
        is_active=True,
    )
    db_session.add(other_client)
    db_session.commit()

    # Register via API to get their token
    reg_resp = client.post("/api/v1/auth/register/client", json={
        "email": "other2@example.com",
        "password": "otherpass123",
        "full_name": "Other Client 2",
    })
    assert reg_resp.status_code == 201
    other_token = reg_resp.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    response = client.get(
        f"/api/v1/checkins/qr/{confirmed_booking.id}",
        headers=other_headers,
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Test 3: Manual check-in by manager succeeds
# ---------------------------------------------------------------------------

def test_checkin_manual_success(
    client,
    db_session,
    confirmed_booking_open_window,
    checkin_window_open_class,
    manager_auth_headers,
    registered_client,
):
    from app.models.client import Client
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    response = client.post(
        "/api/v1/checkins",
        json={
            "method": "manual",
            "scheduled_class_id": checkin_window_open_class.id,
            "client_id": client_obj.id,
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert "client_name" in data
    assert data["client_name"] == "Test Client"
    assert data["method"] == "manual"


# ---------------------------------------------------------------------------
# Test 4: Manual check-in rejected for a client
# ---------------------------------------------------------------------------

def test_checkin_manual_requires_staff(client, confirmed_booking_open_window, client_auth_headers, checkin_window_open_class, db_session, registered_client):
    from app.models.client import Client
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    response = client.post(
        "/api/v1/checkins",
        json={
            "method": "manual",
            "scheduled_class_id": checkin_window_open_class.id,
            "client_id": client_obj.id,
        },
        headers=client_auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


# ---------------------------------------------------------------------------
# Test 5: App check-in by owning client succeeds
# ---------------------------------------------------------------------------

def test_checkin_app_success(client, confirmed_booking_open_window, client_auth_headers):
    response = client.post(
        "/api/v1/checkins",
        json={
            "method": "app",
            "booking_id": confirmed_booking_open_window.id,
        },
        headers=client_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["method"] == "app"
    assert data["booking_id"] == confirmed_booking_open_window.id
    assert data["client_name"] == "Test Client"


# ---------------------------------------------------------------------------
# Test 6: QR check-in with valid token succeeds
# ---------------------------------------------------------------------------

def test_checkin_qr_success(client, confirmed_booking_open_window, client_auth_headers):
    # First get a QR token
    qr_resp = client.get(
        f"/api/v1/checkins/qr/{confirmed_booking_open_window.id}",
        headers=client_auth_headers,
    )
    assert qr_resp.status_code == 200
    qr_token = qr_resp.json()["qr_token"]

    response = client.post(
        "/api/v1/checkins",
        json={
            "method": "qr",
            "qr_token": qr_token,
        },
        headers=client_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["method"] == "qr"
    assert data["booking_id"] == confirmed_booking_open_window.id


# ---------------------------------------------------------------------------
# Test 7: Already checked in → 409
# ---------------------------------------------------------------------------

def test_checkin_already_checked_in(client, confirmed_booking_open_window, client_auth_headers):
    # First check-in
    r1 = client.post(
        "/api/v1/checkins",
        json={"method": "app", "booking_id": confirmed_booking_open_window.id},
        headers=client_auth_headers,
    )
    assert r1.status_code == 201

    # Second check-in
    r2 = client.post(
        "/api/v1/checkins",
        json={"method": "app", "booking_id": confirmed_booking_open_window.id},
        headers=client_auth_headers,
    )
    assert r2.status_code == 409
    assert r2.json()["detail"]["error"]["code"] == "CHECKIN_ALREADY_CHECKED_IN"


# ---------------------------------------------------------------------------
# Test 8: Check-in window not open (class starts in 24h, window is 15 min before)
# ---------------------------------------------------------------------------

def test_checkin_window_not_open(client, confirmed_booking, client_auth_headers):
    """scheduled_class_fixture starts in 24h — well outside the 15-min open window."""
    response = client.post(
        "/api/v1/checkins",
        json={"method": "app", "booking_id": confirmed_booking.id},
        headers=client_auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "CHECKIN_WINDOW_NOT_OPEN"


# ---------------------------------------------------------------------------
# Test 9: Booking not confirmed (cancelled booking)
# ---------------------------------------------------------------------------

def test_checkin_booking_not_confirmed(client, db_session, registered_client, client_membership, checkin_window_open_class, client_auth_headers):
    from app.models.booking import Booking
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    cancelled_booking = Booking(
        client_id=client_obj.id,
        scheduled_class_id=checkin_window_open_class.id,
        status="cancelled",
        credit_deducted=False,
    )
    db_session.add(cancelled_booking)
    db_session.commit()
    db_session.refresh(cancelled_booking)

    response = client.post(
        "/api/v1/checkins",
        json={"method": "app", "booking_id": cancelled_booking.id},
        headers=client_auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "CHECKIN_BOOKING_NOT_CONFIRMED"


# ---------------------------------------------------------------------------
# Test 10: List check-ins for a class (manager)
# ---------------------------------------------------------------------------

def test_list_checkins_for_class(
    client,
    confirmed_booking_open_window,
    checkin_window_open_class,
    manager_auth_headers,
    client_auth_headers,
):
    # First do a check-in
    r = client.post(
        "/api/v1/checkins",
        json={"method": "app", "booking_id": confirmed_booking_open_window.id},
        headers=client_auth_headers,
    )
    assert r.status_code == 201

    # Now list
    response = client.get(
        f"/api/v1/checkins/class/{checkin_window_open_class.id}",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["scheduled_class_id"] == checkin_window_open_class.id
    assert "client_name" in data[0]
