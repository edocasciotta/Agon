"""
Tests for Smart Lists:
- CRUD  (GET/POST/PUT/DELETE /api/v1/smartlists)
- Preview  (GET /api/v1/smartlists/{id}/preview)
"""

import datetime

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_list(client, manager_auth_headers, name="All Clients", filters=None):
    resp = client.post(
        "/api/v1/smartlists",
        json={"name": name, "description": "Test list", "filters": filters or {}},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def test_list_smart_lists_empty(client, manager_auth_headers):
    resp = client.get("/api/v1/smartlists", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_smart_list(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/smartlists",
        json={
            "name": "Active members",
            "description": "All clients with active membership",
            "filters": {"membership_status": "active"},
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Active members"
    assert data["filters"] == {"membership_status": "active"}
    assert "id" in data
    assert "created_at" in data


def test_get_smart_list(client, manager_auth_headers):
    created = _create_list(client, manager_auth_headers)
    resp = client.get(f"/api/v1/smartlists/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_smart_list_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/smartlists/9999", headers=manager_auth_headers)
    assert resp.status_code == 404


def test_update_smart_list(client, manager_auth_headers):
    created = _create_list(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/smartlists/{created['id']}",
        json={"name": "Updated Name", "filters": {"membership_status": "expired"}},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["filters"] == {"membership_status": "expired"}


def test_delete_smart_list(client, manager_auth_headers):
    created = _create_list(client, manager_auth_headers)
    resp = client.delete(f"/api/v1/smartlists/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    resp2 = client.get(f"/api/v1/smartlists/{created['id']}", headers=manager_auth_headers)
    assert resp2.status_code == 404


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------


def test_preview_empty_filters_returns_all_clients(client, manager_auth_headers, db_session):
    """With no filters, all active clients should be returned."""
    from app.auth import hash_password
    from app.models.client import Client

    # Create two clients in the DB
    c1 = Client(
        email="alice@example.com", password_hash=hash_password("pass1234"), full_name="Alice"
    )
    c2 = Client(email="bob@example.com", password_hash=hash_password("pass1234"), full_name="Bob")
    db_session.add_all([c1, c2])
    db_session.commit()

    sl = _create_list(client, manager_auth_headers, filters={})
    resp = client.get(f"/api/v1/smartlists/{sl['id']}/preview", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 2
    emails = [c["email"] for c in data["clients"]]
    assert "alice@example.com" in emails
    assert "bob@example.com" in emails


def test_preview_active_membership_filter(client, manager_auth_headers, db_session):
    """Only clients with an active, non-expired membership are returned."""
    from app.auth import hash_password
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType

    mt = MembershipType(name="Monthly", type="unlimited", price=50.0, is_active=True)
    db_session.add(mt)
    db_session.commit()

    c_active = Client(
        email="active@example.com",
        password_hash=hash_password("pass1234"),
        full_name="Active Member",
    )
    c_no_mem = Client(
        email="nomem@example.com",
        password_hash=hash_password("pass1234"),
        full_name="No Membership",
    )
    db_session.add_all([c_active, c_no_mem])
    db_session.flush()

    future = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    m = Membership(
        client_id=c_active.id,
        membership_type_id=mt.id,
        status="active",
        starts_at=datetime.date.today(),
        expires_at=future,
        credits_remaining=0,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()

    sl = _create_list(client, manager_auth_headers, filters={"membership_status": "active"})
    resp = client.get(f"/api/v1/smartlists/{sl['id']}/preview", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    emails = [c["email"] for c in data["clients"]]
    assert "active@example.com" in emails
    assert "nomem@example.com" not in emails


def test_preview_not_booked_filter(client, manager_auth_headers, db_session):
    """Clients who have not booked within N days should be returned; those who have should not."""
    from app.auth import hash_password
    from app.models.booking import Booking
    from app.models.class_template import ClassTemplate
    from app.models.client import Client
    from app.models.scheduled_class import ScheduledClass

    c_inactive = Client(
        email="inactive@example.com", password_hash=hash_password("pass1234"), full_name="Inactive"
    )
    c_recent = Client(
        email="recent@example.com",
        password_hash=hash_password("pass1234"),
        full_name="Recent Booker",
    )
    db_session.add_all([c_inactive, c_recent])
    db_session.flush()

    # Create a class
    tmpl = ClassTemplate(
        name="Yoga", duration_minutes=60, default_capacity=10, color="#000", is_active=True
    )
    db_session.add(tmpl)
    db_session.flush()
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        ends_at=datetime.datetime.utcnow() + datetime.timedelta(hours=2),
        capacity=10,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.flush()

    # c_recent has a booking within the last 10 days
    b = Booking(
        client_id=c_recent.id, scheduled_class_id=sc.id, status="confirmed", credit_deducted=False
    )
    db_session.add(b)
    db_session.commit()

    sl = _create_list(client, manager_auth_headers, filters={"not_booked_within_days": 10})
    resp = client.get(f"/api/v1/smartlists/{sl['id']}/preview", headers=manager_auth_headers)
    assert resp.status_code == 200
    emails = [c["email"] for c in resp.json()["clients"]]
    assert "inactive@example.com" in emails
    assert "recent@example.com" not in emails
