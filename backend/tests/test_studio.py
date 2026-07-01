

def test_get_studio_not_configured(client, manager_auth_headers):
    """GET /studio with no row → 404"""
    response = client.get("/api/v1/studio", headers=manager_auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_studio_creates_settings(client, manager_auth_headers):
    """PUT /studio as manager → 200, row created"""
    response = client.put(
        "/api/v1/studio",
        json={"studio_name": "Test Studio", "timezone": "Europe/Rome"},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["studio_name"] == "Test Studio"
    assert data["timezone"] == "Europe/Rome"
    assert data["id"] == 1


def test_get_studio_after_update(client, manager_auth_headers):
    """GET /studio after PUT → 200, correct values"""
    client.put(
        "/api/v1/studio",
        json={"studio_name": "My Gym", "cancellation_hours": 4},
        headers=manager_auth_headers,
    )
    response = client.get("/api/v1/studio", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["studio_name"] == "My Gym"
    assert data["cancellation_hours"] == 4


def test_update_studio_requires_manager(client, db_session, manager_auth_headers):
    """PUT /studio as non-manager (instructor) → 403"""
    from app.auth import create_access_token, hash_password
    from app.models.user import User

    instructor_user = User(
        email="inst_studio@example.com",
        password_hash=hash_password("pass123"),
        full_name="Inst Studio",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor_user)
    db_session.commit()
    db_session.refresh(instructor_user)
    token = create_access_token({"sub": str(instructor_user.id), "role": "instructor"})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put(
        "/api/v1/studio",
        json={"studio_name": "Hacked"},
        headers=headers,
    )
    assert response.status_code == 403


def test_studio_status(client, manager_auth_headers):
    """GET /studio/status as manager → 200"""
    response = client.get("/api/v1/studio/status", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "tunnel_url" in data
    assert "tunnel_active" in data
    assert "last_backup_at" in data
