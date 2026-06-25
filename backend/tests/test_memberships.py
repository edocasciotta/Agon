import pytest
import datetime
from app.models.membership_type import MembershipType
from app.models.membership import Membership
from app.models.client import Client


def test_assign_membership(client, manager_auth_headers, db_session, registered_client, membership_type):
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    response = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": membership_type.id,
            "starts_at": str(datetime.date.today()),
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "active"
    assert data["credits_remaining"] == membership_type.credits_included


def test_assign_computes_expires_at(client, manager_auth_headers, db_session, registered_client):
    mt = MembershipType(
        name="30-Day Pass",
        type="credit_pack",
        price=50.0,
        credits_included=None,
        validity_days=30,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    today = datetime.date.today()
    response = client.post(
        "/api/v1/memberships",
        json={
            "client_id": client_obj.id,
            "membership_type_id": mt.id,
            "starts_at": str(today),
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    expected_expires = str(today + datetime.timedelta(days=30))
    assert data["expires_at"] == expected_expires


def test_list_memberships_as_manager(client, manager_auth_headers, client_membership):
    response = client.get("/api/v1/memberships", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_memberships_as_client(client, client_auth_headers, client_membership):
    response = client.get("/api/v1/memberships", headers=client_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for m in data:
        assert m["client_id"] == client_membership.client_id


def test_update_membership(client, manager_auth_headers, client_membership):
    response = client.put(
        f"/api/v1/memberships/{client_membership.id}",
        json={"credits_remaining": 3},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["credits_remaining"] == 3


def test_cancel_membership(client, manager_auth_headers, client_membership):
    response = client.delete(
        f"/api/v1/memberships/{client_membership.id}",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_pause_membership(client, manager_auth_headers, db_session, registered_client):
    mt = MembershipType(
        name="Pauseable Monthly",
        type="recurring",
        price=79.0,
        can_pause=True,
        max_pause_days=30,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=None,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)

    response = client.post(
        f"/api/v1/memberships/{m.id}/pause",
        json={"pause_days": 7},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paused"
    assert data["paused_at"] is not None
    assert data["pause_ends_at"] is not None


def test_resume_membership(client, manager_auth_headers, db_session, registered_client):
    mt = MembershipType(
        name="Pauseable Monthly 2",
        type="recurring",
        price=79.0,
        can_pause=True,
        max_pause_days=30,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=mt.id,
        status="paused",
        starts_at=datetime.date.today(),
        paused_at=datetime.datetime.utcnow(),
        pause_ends_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)

    response = client.post(
        f"/api/v1/memberships/{m.id}/resume",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["paused_at"] is None
    assert data["pause_ends_at"] is None
