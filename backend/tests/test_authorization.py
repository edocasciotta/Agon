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
    resp = client.get(
        f"/api/v1/bookings/{booking_for_client_a.id}", headers=client_b_headers
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_b_cannot_cancel_client_a_booking(client, booking_for_client_a, client_b_headers):
    """Client B must receive 403 when cancelling Client A's booking."""
    resp = client.delete(
        f"/api/v1/bookings/{booking_for_client_a.id}", headers=client_b_headers
    )
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


def test_client_cannot_view_client_bookings_by_id(
    client, client_b_headers, booking_for_client_a
):
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


def test_unauthenticated_cannot_list_bookings(client):
    resp = client.get("/api/v1/bookings")
    assert resp.status_code == 401


def test_unauthenticated_cannot_list_clients(client):
    resp = client.get("/api/v1/clients")
    assert resp.status_code == 401


def test_unauthenticated_cannot_read_studio_settings(client):
    resp = client.get("/api/v1/studio")
    assert resp.status_code == 401
