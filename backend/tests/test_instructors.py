import pytest

INSTRUCTOR_PAYLOAD = {
    "email": "instructor@example.com",
    "password": "instructorpass123",
    "full_name": "Jane Instructor",
    "bio": "Yoga expert",
}


@pytest.fixture
def created_instructor(client, manager_auth_headers):
    """Creates an instructor via the API."""
    response = client.post(
        "/api/v1/instructors",
        json=INSTRUCTOR_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_create_instructor(client, manager_auth_headers):
    """POST /instructors as manager → 201"""
    response = client.post(
        "/api/v1/instructors",
        json=INSTRUCTOR_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Jane Instructor"
    assert data["email"] == "instructor@example.com"
    assert data["bio"] == "Yoga expert"
    assert "id" in data
    assert "user_id" in data


def test_create_instructor_requires_manager(client, db_session):
    """POST as non-manager (instructor role) → 403"""
    from app.auth import create_access_token, hash_password
    from app.models.user import User

    non_manager = User(
        email="other_inst@example.com",
        password_hash=hash_password("pass123"),
        full_name="Other Inst",
        role="instructor",
        is_active=True,
    )
    db_session.add(non_manager)
    db_session.commit()
    db_session.refresh(non_manager)
    token = create_access_token({"sub": str(non_manager.id), "role": "instructor"})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/instructors",
        json=INSTRUCTOR_PAYLOAD,
        headers=headers,
    )
    assert response.status_code == 403


def test_list_instructors(client, manager_auth_headers, created_instructor):
    """GET /instructors → 200, list"""
    response = client.get("/api/v1/instructors", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(i["email"] == "instructor@example.com" for i in data)


def test_list_instructors_search(client, manager_auth_headers, created_instructor):
    """GET /instructors?search=name → filtered by full_name or email"""
    response = client.get("/api/v1/instructors?search=Jane", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert any(i["email"] == "instructor@example.com" for i in data)

    response = client.get(
        "/api/v1/instructors?search=nonexistent-name-zzz", headers=manager_auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


def test_get_instructor(client, manager_auth_headers, created_instructor):
    """GET /instructors/{id} → 200"""
    instructor_id = created_instructor["id"]
    response = client.get(f"/api/v1/instructors/{instructor_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == instructor_id
    assert data["email"] == "instructor@example.com"


def test_get_instructor_not_found(client, manager_auth_headers):
    """GET /instructors/9999 → 404"""
    response = client.get("/api/v1/instructors/9999", headers=manager_auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_instructor(client, manager_auth_headers, created_instructor):
    """PUT /instructors/{id} as manager → 200"""
    instructor_id = created_instructor["id"]
    response = client.put(
        f"/api/v1/instructors/{instructor_id}",
        json={"full_name": "Jane Updated", "bio": "Updated bio"},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Jane Updated"
    assert data["bio"] == "Updated bio"
