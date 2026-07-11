"""Tests for late-cancel and no-show fee functionality."""

import datetime

from app.auth import hash_password
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.payment import Payment
from app.models.scheduled_class import ScheduledClass
from app.models.studio_settings import StudioSettings
from app.models.user import User

# ── Helpers ──────────────────────────────────────────────────────────────────


def _create_studio_settings(db, late_cancel_fee=0.0, no_show_fee=0.0, cancellation_hours=2):
    s = StudioSettings(
        id=1,
        studio_name="Test Studio",
        cancellation_hours=cancellation_hours,
        cancellation_deducts_credit=False,
        late_cancel_fee=late_cancel_fee,
        no_show_fee=no_show_fee,
    )
    db.add(s)
    db.commit()
    return s


def _create_manager(db):
    u = User(
        email="mgr@test.com",
        password_hash=hash_password("mgrpass12345"),
        full_name="Manager",
        role="manager",
        is_active=True,
    )
    db.add(u)
    db.commit()
    return u


def _create_class(db, hours_from_now=24):
    tmpl = ClassTemplate(
        name="Yoga", duration_minutes=60, default_capacity=10, color="#000000", is_active=True
    )
    db.add(tmpl)
    db.commit()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=hours_from_now)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        capacity=10,
        status="scheduled",
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


def _create_client_with_membership(db, membership_type, email="client@test.com"):
    c = Client(
        email=email,
        password_hash=hash_password("clientpass123"),
        full_name="Test Client",
        is_active=True,
    )
    db.add(c)
    db.commit()
    m = Membership(
        client_id=c.id,
        membership_type_id=membership_type.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db.add(m)
    db.commit()
    db.refresh(c)
    return c


def _create_booking(db, client_id, class_id, status="confirmed"):
    b = Booking(
        client_id=client_id,
        scheduled_class_id=class_id,
        status=status,
        credit_deducted=True,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def _get_client_token(test_client, email, password="clientpass123"):
    resp = test_client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _get_manager_token(test_client, email="mgr@test.com", password="mgrpass12345"):
    resp = test_client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ── Late cancel tests ────────────────────────────────────────────────────────


def test_late_cancel_with_fee(client, db_session):
    """Late cancel should charge the studio-level late_cancel_fee."""
    _create_studio_settings(db_session, late_cancel_fee=15.0, cancellation_hours=24)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    # Class in 1 hour => cancel is "late" (window=24h)
    sc = _create_class(db_session, hours_from_now=1)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    token = _get_client_token(client, "client@test.com")
    resp = client.delete(f"/api/v1/bookings/{b.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert data["fee_charged"] == 15.0

    # Verify Payment record was created
    payments = db_session.query(Payment).filter(Payment.client_id == c.id).all()
    assert len(payments) == 1
    assert payments[0].amount == 15.0
    assert payments[0].provider == "system"
    assert payments[0].notes == "late_cancel_fee"


def test_late_cancel_zero_fee(client, db_session):
    """Late cancel with zero fee should not create a Payment."""
    _create_studio_settings(db_session, late_cancel_fee=0.0, cancellation_hours=24)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session, hours_from_now=1)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    token = _get_client_token(client, "client@test.com")
    resp = client.delete(f"/api/v1/bookings/{b.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["fee_charged"] is None

    payments = db_session.query(Payment).filter(Payment.client_id == c.id).all()
    assert len(payments) == 0


def test_late_cancel_membership_override(client, db_session):
    """MembershipType override should take priority over studio default."""
    _create_studio_settings(db_session, late_cancel_fee=15.0, cancellation_hours=24)
    _create_manager(db_session)
    mt = MembershipType(
        name="Premium",
        type="credit_pack",
        price=200.0,
        credits_included=20,
        is_active=True,
        late_cancel_fee_override=5.0,
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session, hours_from_now=1)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    token = _get_client_token(client, "client@test.com")
    resp = client.delete(f"/api/v1/bookings/{b.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["fee_charged"] == 5.0

    payments = db_session.query(Payment).filter(Payment.client_id == c.id).all()
    assert len(payments) == 1
    assert payments[0].amount == 5.0


# ── No-show tests ────────────────────────────────────────────────────────────


def test_no_show_with_fee(client, db_session):
    """No-show should charge the studio-level no_show_fee."""
    _create_studio_settings(db_session, no_show_fee=25.0)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    mgr_token = _get_manager_token(client)
    resp = client.post(
        f"/api/v1/bookings/{b.id}/no-show",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "no_show"
    assert data["fee_charged"] == 25.0

    payments = db_session.query(Payment).filter(Payment.client_id == c.id).all()
    assert len(payments) == 1
    assert payments[0].amount == 25.0
    assert payments[0].notes == "no_show_fee"


def test_no_show_zero_fee(client, db_session):
    """No-show with zero fee should not create a Payment."""
    _create_studio_settings(db_session, no_show_fee=0.0)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    mgr_token = _get_manager_token(client)
    resp = client.post(
        f"/api/v1/bookings/{b.id}/no-show",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["fee_charged"] is None

    payments = db_session.query(Payment).filter(Payment.client_id == c.id).all()
    assert len(payments) == 0


def test_no_show_requires_manager(client, db_session):
    """No-show endpoint must reject non-manager callers."""
    _create_studio_settings(db_session, no_show_fee=25.0)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id)

    client_token = _get_client_token(client, "client@test.com")
    resp = client.post(
        f"/api/v1/bookings/{b.id}/no-show",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_no_show_on_cancelled_booking(client, db_session):
    """No-show on already-cancelled booking should return error."""
    _create_studio_settings(db_session, no_show_fee=25.0)
    _create_manager(db_session)
    mt = MembershipType(
        name="Pack", type="credit_pack", price=100.0, credits_included=10, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    sc = _create_class(db_session)
    c = _create_client_with_membership(db_session, mt)
    b = _create_booking(db_session, c.id, sc.id, status="cancelled")

    mgr_token = _get_manager_token(client)
    resp = client.post(
        f"/api/v1/bookings/{b.id}/no-show",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_NOT_CONFIRMED"
