def test_create_membership_type(client, manager_auth_headers):
    response = client.post(
        "/api/v1/membership-types",
        json={
            "name": "Monthly Unlimited",
            "type": "recurring",
            "price": 79.0,
            "billing_interval": "monthly",
            "unlimited": True,
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Monthly Unlimited"
    assert data["type"] == "recurring"
    assert data["is_active"] is True


def test_list_membership_types(client, manager_auth_headers, membership_type):
    response = client.get("/api/v1/membership-types", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_membership_types_client_can_access(client, client_auth_headers, membership_type):
    """Members (role=client) must be able to list plans for self-purchase."""
    response = client.get("/api/v1/membership-types", headers=client_auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_membership_type(client, manager_auth_headers, membership_type):
    response = client.get(
        f"/api/v1/membership-types/{membership_type.id}", headers=manager_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == membership_type.id
    assert data["name"] == membership_type.name


def test_update_membership_type(client, manager_auth_headers, membership_type):
    response = client.put(
        f"/api/v1/membership-types/{membership_type.id}",
        json={"price": 120.0, "validity_days": 30},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["price"] == 120.0
    assert data["validity_days"] == 30


def test_deactivate_membership_type(client, manager_auth_headers, membership_type):
    response = client.delete(
        f"/api/v1/membership-types/{membership_type.id}",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


def test_reactivate_membership_type(client, manager_auth_headers, membership_type, db_session):
    # deactivate first
    membership_type.is_active = False
    db_session.commit()

    response = client.patch(
        f"/api/v1/membership-types/{membership_type.id}/reactivate",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True


def test_reactivate_not_found(client, manager_auth_headers):
    response = client.patch(
        "/api/v1/membership-types/999999/reactivate",
        headers=manager_auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_remove_membership_type_no_members(client, manager_auth_headers, membership_type):
    response = client.delete(
        f"/api/v1/membership-types/{membership_type.id}/remove",
        headers=manager_auth_headers,
    )
    assert response.status_code == 204


def test_remove_membership_type_blocked_with_members(
    client, manager_auth_headers, membership_type, db_session
):
    from datetime import datetime

    from app.models.membership import Membership

    m = Membership(
        client_id=1,
        membership_type_id=membership_type.id,
        status="active",
        starts_at=datetime(2025, 1, 1),
        credits_remaining=10,
    )
    db_session.add(m)
    db_session.commit()

    response = client.delete(
        f"/api/v1/membership-types/{membership_type.id}/remove",
        headers=manager_auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "MEMBERSHIP_TYPE_HAS_MEMBERS"


def test_remove_not_found(client, manager_auth_headers):
    response = client.delete(
        "/api/v1/membership-types/999999/remove",
        headers=manager_auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_create_requires_manager(client, db_session):
    """POST as non-manager (instructor role) → 403"""
    from app.auth import create_access_token, hash_password
    from app.models.user import User

    instructor = User(
        email="inst_mt@example.com",
        password_hash=hash_password("pass123"),
        full_name="Instructor MT",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor)
    db_session.commit()
    db_session.refresh(instructor)
    token = create_access_token({"sub": str(instructor.id), "role": "instructor"})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/membership-types",
        json={"name": "Test Pack", "type": "credit_pack", "price": 50.0},
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"
