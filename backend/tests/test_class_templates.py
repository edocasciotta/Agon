import pytest


TEMPLATE_PAYLOAD = {
    "name": "Yoga Flow",
    "description": "A relaxing yoga session",
    "duration_minutes": 60,
    "default_capacity": 15,
    "color": "#4F46E5",
}


@pytest.fixture
def created_template(client, manager_auth_headers):
    response = client.post(
        "/api/v1/class-templates",
        json=TEMPLATE_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_create_template(client, manager_auth_headers):
    """POST /class-templates as manager → 201"""
    response = client.post(
        "/api/v1/class-templates",
        json=TEMPLATE_PAYLOAD,
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Yoga Flow"
    assert data["duration_minutes"] == 60
    assert data["is_active"] == True
    assert "id" in data


def test_list_templates(client, manager_auth_headers, created_template):
    """GET /class-templates → 200"""
    response = client.get("/api/v1/class-templates", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(t["name"] == "Yoga Flow" for t in data)


def test_get_template(client, manager_auth_headers, created_template):
    """GET /class-templates/{id} → 200"""
    template_id = created_template["id"]
    response = client.get(f"/api/v1/class-templates/{template_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template_id
    assert data["name"] == "Yoga Flow"


def test_update_template(client, manager_auth_headers, created_template):
    """PUT /class-templates/{id} → 200"""
    template_id = created_template["id"]
    response = client.put(
        f"/api/v1/class-templates/{template_id}",
        json={"name": "Yoga Flow Advanced", "duration_minutes": 90},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Yoga Flow Advanced"
    assert data["duration_minutes"] == 90


def test_delete_template_deactivates(client, manager_auth_headers, created_template):
    """DELETE /class-templates/{id} → 200, is_active=False"""
    template_id = created_template["id"]
    response = client.delete(
        f"/api/v1/class-templates/{template_id}",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] == False

    # Should not appear in the default list anymore
    list_resp = client.get("/api/v1/class-templates", headers=manager_auth_headers)
    assert all(t["id"] != template_id for t in list_resp.json())

    # But should appear when include_inactive=true
    list_resp2 = client.get(
        "/api/v1/class-templates?include_inactive=true", headers=manager_auth_headers
    )
    assert any(t["id"] == template_id for t in list_resp2.json())


def test_create_template_requires_manager(client, db_session):
    """POST as non-manager (instructor role) → 403"""
    from app.models.user import User
    from app.auth import hash_password, create_access_token
    non_manager = User(
        email="inst_tmpl@example.com",
        password_hash=hash_password("pass123"),
        full_name="Inst Tmpl",
        role="instructor",
        is_active=True,
    )
    db_session.add(non_manager)
    db_session.commit()
    db_session.refresh(non_manager)
    token = create_access_token({"sub": str(non_manager.id), "role": "instructor"})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/class-templates",
        json=TEMPLATE_PAYLOAD,
        headers=headers,
    )
    assert response.status_code == 403
