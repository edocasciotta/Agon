import pytest


@pytest.fixture
def sample_client(db_session):
    """Creates a second client directly in the DB for manager operations."""
    from app.auth import hash_password
    from app.models.client import Client

    c = Client(
        email="john@example.com",
        password_hash=hash_password("password123"),
        full_name="John Doe",
        phone="555-1234",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


def test_list_clients_as_manager(client, manager_auth_headers, registered_client):
    """GET /clients as manager → 200, paginated envelope"""
    response = client.get("/api/v1/clients", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)
    assert len(data["items"]) >= 1
    assert data["total"] >= 1
    assert data["page"] == 1
    assert data["page_size"] == 20


def test_list_clients_search(client, manager_auth_headers, sample_client):
    """GET /clients?search=name → filtered results"""
    response = client.get("/api/v1/clients?search=John", headers=manager_auth_headers)
    assert response.status_code == 200
    results = response.json()["items"]
    assert any("John" in r["full_name"] for r in results)


def test_list_clients_pagination(client, manager_auth_headers, db_session):
    """GET /clients?page=2&page_size=2 → second page of results, correct total"""
    from app.auth import hash_password
    from app.models.client import Client

    for i in range(5):
        db_session.add(
            Client(
                email=f"page{i}@example.com",
                password_hash=hash_password("password123"),
                full_name=f"Page Client {i}",
            )
        )
    db_session.commit()

    response = client.get("/api/v1/clients?page=2&page_size=2", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["page_size"] == 2
    assert len(data["items"]) == 2
    assert data["total"] >= 5


def test_get_client_as_manager(client, manager_auth_headers, sample_client):
    """GET /clients/{id} → 200"""
    response = client.get(f"/api/v1/clients/{sample_client.id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sample_client.id
    assert data["email"] == "john@example.com"


def test_get_client_not_found(client, manager_auth_headers):
    """GET /clients/9999 → 404"""
    response = client.get("/api/v1/clients/9999", headers=manager_auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_client_as_manager(client, manager_auth_headers, sample_client):
    """PUT /clients/{id} → 200"""
    response = client.put(
        f"/api/v1/clients/{sample_client.id}",
        json={"full_name": "John Updated", "phone": "555-9999"},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "John Updated"
    assert data["phone"] == "555-9999"


def test_delete_client_anonymizes(client, manager_auth_headers, sample_client):
    """DELETE /clients/{id} → 200, data anonymized"""
    response = client.delete(
        f"/api/v1/clients/{sample_client.id}",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "anonymized"

    # Verify the anonymization
    get_resp = client.get(f"/api/v1/clients/{sample_client.id}", headers=manager_auth_headers)
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["full_name"] == "[deleted]"
    assert data["email"] == f"deleted_{sample_client.id}@anon.agon"
    assert not data["is_active"]


def test_client_get_own_profile(client, registered_client, client_auth_headers):
    """GET /clients/me as client → 200"""
    response = client.get("/api/v1/clients/me", headers=client_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == registered_client["email"]


def test_client_update_own_profile(client, registered_client, client_auth_headers):
    """PUT /clients/me as client → 200"""
    response = client.put(
        "/api/v1/clients/me",
        json={"full_name": "Updated Name", "phone": "999-9999"},
        headers=client_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["phone"] == "999-9999"
