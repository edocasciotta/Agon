from unittest.mock import MagicMock

import pytest
from app.models.client import Client
from app.models.notification_log import NotificationLog


@pytest.fixture(autouse=True)
def mock_push(monkeypatch):
    """Prevent actual Expo API calls during tests."""
    mock_response = MagicMock()
    mock_response.id = "test-ticket-id"
    mock_response.validate_response = MagicMock()

    mock_instance = MagicMock()
    mock_instance.publish.return_value = mock_response

    mock_push_client_cls = MagicMock(return_value=mock_instance)

    import app.services.push_service as push_svc

    monkeypatch.setattr(push_svc, "PushClient", mock_push_client_cls)
    monkeypatch.setattr(push_svc, "_EXPO_AVAILABLE", True)
    yield mock_push_client_cls


def test_send_notification_as_manager(client, manager_auth_headers, registered_client, db_session):
    """Manager can send a push notification to a client."""
    # Get the registered client's ID
    rc = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    response = client.post(
        "/api/v1/notifications/send",
        json={"client_id": rc.id, "title": "Test Title", "body": "Test Body"},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    assert response.json() == {"status": "queued"}


def test_send_notification_requires_manager(client, db_session, registered_client):
    """Non-managers (instructor role) cannot send manual push notifications."""
    from app.auth import hash_password
    from app.models.client import Client
    from app.models.user import User

    # Create an instructor user and log in
    instructor = User(
        email="instructor2@example.com",
        password_hash=hash_password("instrpass123"),
        full_name="Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor)
    db_session.commit()
    login_resp = client.post(
        "/api/v1/auth/login", json={"email": "instructor2@example.com", "password": "instrpass123"}
    )
    token = login_resp.json()["access_token"]
    instructor_headers = {"Authorization": f"Bearer {token}"}

    rc = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    response = client.post(
        "/api/v1/notifications/send",
        json={"client_id": rc.id, "title": "Test", "body": "Test"},
        headers=instructor_headers,
    )
    assert response.status_code == 403


def test_list_notifications_as_client(client, client_auth_headers, registered_client, db_session):
    """Client can list their own notifications."""
    rc = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    # Insert a notification for the client
    notif = NotificationLog(
        client_id=rc.id,
        type="manual",
        title="Hello",
        body="World",
        status="sent",
    )
    db_session.add(notif)
    db_session.commit()

    response = client.get("/api/v1/notifications", headers=client_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["title"] == "Hello"


def test_list_notifications_empty(client, client_auth_headers):
    """Client with no notifications gets an empty list."""
    response = client.get("/api/v1/notifications", headers=client_auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_mark_notification_read(client, client_auth_headers, registered_client, db_session):
    """Client can acknowledge their own notification."""
    rc = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    # Insert a notification directly
    notif = NotificationLog(
        client_id=rc.id,
        type="manual",
        title="Read Me",
        body="Please",
        status="sent",
    )
    db_session.add(notif)
    db_session.commit()
    db_session.refresh(notif)

    response = client.put(
        f"/api/v1/notifications/{notif.id}/read",
        headers=client_auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
