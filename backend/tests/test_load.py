"""Load correctness tests for the booking engine.

Verifies that when N clients race to book a class with capacity K (N > K),
the engine accepts exactly K bookings and rejects the rest — no overbooking,
no duplicate bookings for the same client.

Uses sequential TestClient calls (SQLite is single-writer) to exercise the
same code paths as concurrent requests without SQLite deadlock issues.
"""

import datetime

import pytest
from app.auth import hash_password
from app.database import Base, get_db
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.scheduled_class import ScheduledClass
from fastapi.testclient import TestClient
from main import app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

CLASS_CAPACITY = 50
TOTAL_CLIENTS = 100


@pytest.fixture(scope="module")
def load_client():
    """Isolated DB with 100 clients (each with a membership) and one class."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Membership type
    mtype = MembershipType(
        name="10-Pack", type="credit_pack", price=80.0, credits_included=10, is_active=True
    )
    db.add(mtype)
    db.flush()

    # Class template + scheduled class (capacity 50)
    tmpl = ClassTemplate(
        name="Spin", duration_minutes=45, default_capacity=CLASS_CAPACITY, color="#000"
    )
    db.add(tmpl)
    db.flush()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(minutes=45),
        capacity=CLASS_CAPACITY,
        status="scheduled",
    )
    db.add(sc)
    db.flush()

    # 100 clients + 100 memberships
    clients = []
    for i in range(TOTAL_CLIENTS):
        c = Client(
            email=f"load_client_{i}@test.com",
            password_hash=hash_password("loadpass123"),
            full_name=f"Load Client {i}",
            is_active=True,
        )
        db.add(c)
        clients.append(c)
    db.flush()

    for c in clients:
        m = Membership(
            client_id=c.id,
            membership_type_id=mtype.id,
            status="active",
            starts_at=datetime.date.today(),
            credits_remaining=10,
            credits_used=0,
        )
        db.add(m)
    db.commit()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc, db, sc, clients
    app.dependency_overrides.clear()
    db.close()


def _login(tc: TestClient, email: str) -> dict:
    resp = tc.post("/api/v1/auth/login", json={"email": email, "password": "loadpass123"})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_no_overbooking_under_load(load_client):
    """Exactly CLASS_CAPACITY bookings confirmed; remainder rejected as class-full."""
    tc, db, sc, clients = load_client

    confirmed = 0
    full_errors = 0
    other_errors = []

    for c in clients:
        headers = _login(tc, c.email)
        resp = tc.post(
            "/api/v1/bookings",
            json={"scheduled_class_id": sc.id},
            headers=headers,
        )
        if resp.status_code in (200, 201):
            confirmed += 1
        elif (
            resp.status_code == 409
            and resp.json().get("detail", {}).get("error", {}).get("code") == "BOOKING_CLASS_FULL"
        ):
            full_errors += 1
        else:
            other_errors.append((c.email, resp.status_code, resp.text))

    assert not other_errors, f"Unexpected errors: {other_errors}"
    assert (
        confirmed == CLASS_CAPACITY
    ), f"Expected {CLASS_CAPACITY} confirmed bookings, got {confirmed}"
    assert (
        full_errors == TOTAL_CLIENTS - CLASS_CAPACITY
    ), f"Expected {TOTAL_CLIENTS - CLASS_CAPACITY} class-full rejections, got {full_errors}"


def test_db_booking_count_matches_capacity(load_client):
    """The database contains exactly CLASS_CAPACITY confirmed bookings for the class."""
    tc, db, sc, clients = load_client

    db.expire_all()
    confirmed_in_db = (
        db.query(Booking)
        .filter(
            Booking.scheduled_class_id == sc.id,
            Booking.status == "confirmed",
        )
        .count()
    )
    assert (
        confirmed_in_db == CLASS_CAPACITY
    ), f"DB has {confirmed_in_db} confirmed bookings, expected {CLASS_CAPACITY}"


def test_no_duplicate_bookings_for_same_client(load_client):
    """No client appears in more than one confirmed booking for the same class."""
    tc, db, sc, clients = load_client

    db.expire_all()
    bookings = (
        db.query(Booking)
        .filter(
            Booking.scheduled_class_id == sc.id,
            Booking.status == "confirmed",
        )
        .all()
    )
    client_ids = [b.client_id for b in bookings]
    assert len(client_ids) == len(
        set(client_ids)
    ), "Duplicate bookings detected for the same client"
