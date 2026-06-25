import pytest
import datetime


def test_record_manual_payment(client, manager_auth_headers, db_session, registered_client):
    from app.models.client import Client
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    response = client.post(
        "/api/v1/payments",
        json={
            "client_id": client_obj.id,
            "amount": 100.0,
            "currency": "EUR",
            "notes": "Test payment",
        },
        headers=manager_auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["provider"] == "manual"
    assert data["amount"] == 100.0
    assert data["client_id"] == client_obj.id


def test_list_payments_as_manager(client, manager_auth_headers, db_session, registered_client):
    from app.models.client import Client
    from app.models.payment import Payment
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    p = Payment(
        client_id=client_obj.id,
        amount=50.0,
        currency="EUR",
        status="completed",
        provider="manual",
        paid_at=datetime.datetime.utcnow(),
    )
    db_session.add(p)
    db_session.commit()

    response = client.get("/api/v1/payments", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_payments_as_client(client, client_auth_headers, db_session, registered_client):
    from app.models.client import Client
    from app.models.payment import Payment
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    p = Payment(
        client_id=client_obj.id,
        amount=50.0,
        currency="EUR",
        status="completed",
        provider="manual",
        paid_at=datetime.datetime.utcnow(),
    )
    db_session.add(p)
    db_session.commit()

    response = client.get("/api/v1/payments", headers=client_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for payment in data:
        assert payment["client_id"] == client_obj.id


def test_get_payment(client, manager_auth_headers, db_session, registered_client):
    from app.models.client import Client
    from app.models.payment import Payment
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    p = Payment(
        client_id=client_obj.id,
        amount=75.0,
        currency="EUR",
        status="completed",
        provider="manual",
        paid_at=datetime.datetime.utcnow(),
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    response = client.get(f"/api/v1/payments/{p.id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == p.id
    assert data["amount"] == 75.0


def test_refund_payment(client, manager_auth_headers, db_session, registered_client):
    from app.models.client import Client
    from app.models.payment import Payment
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    p = Payment(
        client_id=client_obj.id,
        amount=100.0,
        currency="EUR",
        status="completed",
        provider="manual",
        paid_at=datetime.datetime.utcnow(),
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    response = client.post(f"/api/v1/payments/{p.id}/refund", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refunded"


def test_stripe_webhook_invalid_signature(client):
    response = client.post(
        "/api/v1/payments/stripe/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={
            "Content-Type": "application/json",
            "Stripe-Signature": "t=12345,v1=invalidsignature",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"]["code"] == "STRIPE_INVALID_SIGNATURE"
