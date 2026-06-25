import pytest
from datetime import datetime, timedelta


@pytest.fixture
def template(client, manager_auth_headers):
    response = client.post(
        "/api/v1/class-templates",
        json={
            "name": "HIIT",
            "duration_minutes": 45,
            "default_capacity": 10,
            "color": "#FF0000",
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def scheduled_class(client, manager_auth_headers, template):
    starts = datetime.utcnow() + timedelta(days=1)
    ends = starts + timedelta(minutes=45)
    response = client.post(
        "/api/v1/classes",
        json={
            "template_id": template["id"],
            "starts_at": starts.isoformat(),
            "ends_at": ends.isoformat(),
            "capacity": 10,
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_schedule_single_class(client, manager_auth_headers, template):
    """POST /classes as manager → 201"""
    starts = datetime.utcnow() + timedelta(days=2)
    ends = starts + timedelta(minutes=45)
    response = client.post(
        "/api/v1/classes",
        json={
            "template_id": template["id"],
            "starts_at": starts.isoformat(),
            "ends_at": ends.isoformat(),
            "capacity": 12,
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["template_id"] == template["id"]
    assert data["capacity"] == 12
    assert data["status"] == "scheduled"


def test_schedule_recurring_classes(client, manager_auth_headers, template):
    """POST /classes/recurring → 201, returns count"""
    # Next Monday
    today = datetime.utcnow()
    days_until_monday = (7 - today.weekday()) % 7 or 7
    first_monday = today + timedelta(days=days_until_monday)
    ends = first_monday + timedelta(hours=1)

    response = client.post(
        "/api/v1/classes/recurring",
        json={
            "template_id": template["id"],
            "starts_at": first_monday.isoformat(),
            "ends_at": ends.isoformat(),
            "capacity": 10,
            "days_of_week": [0],  # Monday only
            "max_occurrences": 4,
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 4
    assert "recurrence_group_id" in data
    assert len(data["recurrence_group_id"]) > 0


def test_list_classes(client, manager_auth_headers, scheduled_class):
    """GET /classes → 200"""
    response = client.get("/api/v1/classes", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_classes_with_filters(client, manager_auth_headers, scheduled_class):
    """GET /classes?status=scheduled → filtered"""
    response = client.get("/api/v1/classes?status=scheduled", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(c["status"] == "scheduled" for c in data)

    response2 = client.get("/api/v1/classes?status=cancelled", headers=manager_auth_headers)
    assert response2.status_code == 200
    assert len(response2.json()) == 0


def test_get_class(client, manager_auth_headers, scheduled_class):
    """GET /classes/{id} → 200"""
    class_id = scheduled_class["id"]
    response = client.get(f"/api/v1/classes/{class_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_id


def test_update_class(client, manager_auth_headers, scheduled_class):
    """PUT /classes/{id} → 200"""
    class_id = scheduled_class["id"]
    new_start = datetime.utcnow() + timedelta(days=3)
    new_end = new_start + timedelta(minutes=45)
    response = client.put(
        f"/api/v1/classes/{class_id}",
        json={
            "capacity": 20,
            "starts_at": new_start.isoformat(),
            "ends_at": new_end.isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["capacity"] == 20


def test_cancel_class(client, manager_auth_headers, scheduled_class):
    """DELETE /classes/{id} → 200, status=cancelled"""
    class_id = scheduled_class["id"]
    response = client.delete(f"/api/v1/classes/{class_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_complete_class(client, manager_auth_headers, scheduled_class):
    """POST /classes/{id}/complete → 200, status=completed"""
    class_id = scheduled_class["id"]
    response = client.post(
        f"/api/v1/classes/{class_id}/complete",
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


def test_get_roster_empty(client, manager_auth_headers, scheduled_class):
    """GET /classes/{id}/roster → 200, empty list"""
    class_id = scheduled_class["id"]
    response = client.get(f"/api/v1/classes/{class_id}/roster", headers=manager_auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_get_waitlist_empty(client, manager_auth_headers, scheduled_class):
    """GET /classes/{id}/waitlist → 200, empty list"""
    class_id = scheduled_class["id"]
    response = client.get(f"/api/v1/classes/{class_id}/waitlist", headers=manager_auth_headers)
    assert response.status_code == 200
    assert response.json() == []
