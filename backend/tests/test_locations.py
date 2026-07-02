import pytest

LOCATION_PAYLOAD = {"name": "Downtown Studio", "address": "123 Main St", "phone": "+1 555 0100"}


@pytest.fixture
def created_location(client, manager_auth_headers):
    """Creates a location via the API."""
    response = client.post(
        "/api/v1/locations",
        json=LOCATION_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_create_location(client, manager_auth_headers):
    """POST /locations as manager → 201"""
    response = client.post(
        "/api/v1/locations",
        json=LOCATION_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Downtown Studio"
    assert data["is_active"] is True


def test_list_locations(client, manager_auth_headers, created_location):
    """GET /locations → 200, list"""
    response = client.get("/api/v1/locations", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(loc["name"] == "Downtown Studio" for loc in data)


def test_list_locations_search(client, manager_auth_headers, created_location):
    """GET /locations?search=name → filtered by name"""
    response = client.get("/api/v1/locations?search=Downtown", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert any(loc["name"] == "Downtown Studio" for loc in data)

    response = client.get(
        "/api/v1/locations?search=nonexistent-name-zzz", headers=manager_auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


def test_list_locations_requires_manager(client, client_auth_headers):
    """GET /locations as client role → 403"""
    response = client.get("/api/v1/locations", headers=client_auth_headers)
    assert response.status_code == 403
