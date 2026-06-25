import pytest
import datetime


@pytest.fixture
def report_data(db_session, manager_user, membership_type):
    """Seeds minimal data for report queries."""
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.payment import Payment
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass
    from app.models.booking import Booking
    from app.models.checkin import Checkin
    from app.auth import hash_password

    # Client
    c = Client(
        email="reportclient@example.com",
        password_hash=hash_password("pass12345"),
        full_name="Report Client",
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()

    # Membership
    m = Membership(
        client_id=c.id,
        membership_type_id=membership_type.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=2,
    )
    db_session.add(m)
    db_session.commit()

    # Payment
    p = Payment(
        client_id=c.id,
        membership_id=m.id,
        amount=100.0,
        currency="EUR",
        status="completed",
        provider="manual",
        paid_at=datetime.datetime.utcnow(),
    )
    db_session.add(p)

    # Class template + scheduled class (in the past, completed)
    tmpl = ClassTemplate(
        name="Report Yoga",
        duration_minutes=60,
        default_capacity=10,
        color="#000000",
        is_active=True,
    )
    db_session.add(tmpl)
    db_session.commit()

    past = datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=past,
        ends_at=past + datetime.timedelta(hours=1),
        capacity=10,
        status="completed",
    )
    db_session.add(sc)
    db_session.commit()

    # Booking
    b = Booking(
        client_id=c.id,
        scheduled_class_id=sc.id,
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(b)
    db_session.commit()

    # Checkin
    ci = Checkin(
        booking_id=b.id,
        client_id=c.id,
        scheduled_class_id=sc.id,
        method="manual",
    )
    db_session.add(ci)
    db_session.commit()

    return {"client": c, "membership": m, "payment": p, "class": sc, "booking": b}


def test_attendance_report(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/attendance", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "period" in data
    assert "total_classes" in data
    assert "total_bookings" in data
    assert "total_checkins" in data
    assert "checkin_rate" in data
    assert "avg_class_size" in data
    assert "by_class_template" in data


def test_revenue_report(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/revenue", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_revenue"] >= 100.0
    assert "by_provider" in data
    assert "monthly_trend" in data


def test_memberships_report(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/memberships", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_active" in data
    assert "total_expired" in data
    assert "total_cancelled" in data
    assert "new_this_period" in data
    assert "by_type" in data


def test_retention_report(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/retention", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_clients" in data
    assert "active_clients" in data
    assert "new_clients" in data
    assert "churned_clients" in data
    assert "retention_rate" in data


def test_attendance_csv_export(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/attendance/export", headers=manager_auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")


def test_revenue_csv_export(client, manager_auth_headers, report_data):
    response = client.get("/api/v1/reports/revenue/export", headers=manager_auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
