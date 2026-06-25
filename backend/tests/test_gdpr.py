import pytest
import datetime


@pytest.fixture
def gdpr_client_data(db_session, membership_type):
    """Creates a client with some associated data for GDPR tests."""
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.booking import Booking
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass
    from app.auth import hash_password

    c = Client(
        email="gdprclient@example.com",
        password_hash=hash_password("gdprpass123"),
        full_name="GDPR Client",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()

    m = Membership(
        client_id=c.id,
        membership_type_id=membership_type.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()

    return c


@pytest.fixture
def gdpr_client_auth_headers(client, gdpr_client_data):
    """Returns auth headers for the gdpr test client."""
    response = client.post("/api/v1/auth/login", json={
        "email": "gdprclient@example.com",
        "password": "gdprpass123",
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_gdpr_export_as_manager(client, manager_auth_headers, gdpr_client_data):
    client_id = gdpr_client_data.id
    response = client.get(f"/api/v1/gdpr/export/{client_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "client" in data
    assert "bookings" in data
    assert "memberships" in data
    assert "payments" in data
    assert "checkins" in data
    assert "consent_log" in data


def test_gdpr_export_as_own_client(client, gdpr_client_data, gdpr_client_auth_headers):
    client_id = gdpr_client_data.id
    response = client.get(f"/api/v1/gdpr/export/{client_id}", headers=gdpr_client_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "client" in data


def test_gdpr_delete(client, manager_auth_headers, gdpr_client_data, db_session):
    client_id = gdpr_client_data.id
    response = client.post(f"/api/v1/gdpr/delete/{client_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    assert data["client_id"] == client_id

    # Verify anonymization
    from app.models.client import Client
    db_session.expire_all()
    updated = db_session.query(Client).filter(Client.id == client_id).first()
    assert updated.full_name == "[deleted]"
    assert updated.email == f"deleted_{client_id}@anon.agon"
    assert updated.is_active is False


def test_record_consent(client, gdpr_client_auth_headers):
    response = client.post(
        "/api/v1/gdpr/consent",
        json={"consent_type": "marketing", "granted": True, "ip_address": "127.0.0.1"},
        headers=gdpr_client_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["consent_type"] == "marketing"
    assert data["granted"] is True


def test_get_consent_log(client, manager_auth_headers, gdpr_client_data, gdpr_client_auth_headers, db_session):
    # First record a consent entry
    client.post(
        "/api/v1/gdpr/consent",
        json={"consent_type": "privacy_policy", "granted": True},
        headers=gdpr_client_auth_headers,
    )

    client_id = gdpr_client_data.id
    response = client.get(f"/api/v1/gdpr/consent-log/{client_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["consent_type"] == "privacy_policy"
