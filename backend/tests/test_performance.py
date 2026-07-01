"""Performance tests: core queries must complete in <100ms with realistic data volumes."""

import datetime
import time

import pytest
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.instructor import Instructor
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.scheduled_class import ScheduledClass
from app.models.user import User


@pytest.fixture(scope="module")
def perf_db(tmp_path_factory):
    """Isolated in-memory DB pre-loaded with realistic data volumes."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    tmp = tmp_path_factory.mktemp("perf")
    engine = create_engine(
        f"sqlite:///{tmp}/perf.db",
        connect_args={"check_same_thread": False},
    )
    # Apply WAL + FK pragmas
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_pragma(conn, _rec):
        c = conn.cursor()
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA synchronous=NORMAL")
        c.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # ── Seed data ──────────────────────────────────────────────────────────────
    now = datetime.datetime.utcnow()

    # 1 membership type
    mtype = MembershipType(name="Monthly", type="recurring", price=50, currency="EUR")
    db.add(mtype)
    db.flush()

    # 1 class template
    template = ClassTemplate(name="Yoga", duration_minutes=60, default_capacity=20, color="#4F46E5")
    db.add(template)
    db.flush()

    # 1 instructor (requires a User row due to user_id FK)
    instr_user = User(
        email="instr@perf.test",
        password_hash="x",
        full_name="Test Instructor",
        role="instructor",
    )
    db.add(instr_user)
    db.flush()
    instructor = Instructor(user_id=instr_user.id)
    db.add(instructor)
    db.flush()

    # 500 clients + memberships
    clients = []
    memberships = []
    for i in range(500):
        c = Client(
            full_name=f"Client {i}",
            email=f"client{i}@perf.test",
            password_hash="x",
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
        )
        db.add(m)
        memberships.append(m)
    db.flush()

    # 1000 scheduled classes spread over 30 days
    classes = []
    for i in range(1000):
        day_offset = i % 30
        sc = ScheduledClass(
            template_id=template.id,
            instructor_id=instructor.id,
            starts_at=now + datetime.timedelta(days=day_offset, hours=i % 24),
            ends_at=now + datetime.timedelta(days=day_offset, hours=(i % 24) + 1),
            capacity=20,
            status="scheduled",
        )
        db.add(sc)
        classes.append(sc)
    db.flush()

    # 2000 bookings: each client gets 4 bookings in consecutive classes.
    # client index = i // 4  (0..499), class index = i % 1000  (0..999)
    # No (client, class) pair repeats because within the same client bucket
    # (i // 4 constant) the class index advances by 1 each step.
    for i in range(2000):
        b = Booking(
            client_id=clients[i // 4].id,
            scheduled_class_id=classes[i % 1000].id,
            status="confirmed" if i % 10 != 0 else "cancelled",
        )
        db.add(b)
    db.flush()
    db.commit()

    yield db
    db.close()


def _elapsed_ms(fn) -> float:
    t0 = time.perf_counter()
    fn()
    return (time.perf_counter() - t0) * 1000


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_list_classes_by_date_range(perf_db):
    """Listing scheduled classes for the next 7 days must be <100ms."""
    db = perf_db
    now = datetime.datetime.utcnow()
    week_later = now + datetime.timedelta(days=7)

    ms = _elapsed_ms(
        lambda: db.query(ScheduledClass)
        .filter(
            ScheduledClass.starts_at >= now,
            ScheduledClass.starts_at <= week_later,
            ScheduledClass.status == "scheduled",
        )
        .all()
    )
    assert ms < 100, f"list classes took {ms:.1f}ms (> 100ms)"


def test_list_bookings_for_class(perf_db):
    """Listing all confirmed bookings for a single class must be <100ms."""
    db = perf_db
    first_class = db.query(ScheduledClass).first()

    ms = _elapsed_ms(
        lambda: db.query(Booking)
        .filter(
            Booking.scheduled_class_id == first_class.id,
            Booking.status == "confirmed",
        )
        .all()
    )
    assert ms < 100, f"list bookings for class took {ms:.1f}ms (> 100ms)"


def test_list_bookings_for_client(perf_db):
    """Listing all bookings for a single client must be <100ms."""
    db = perf_db
    first_client = db.query(Client).first()

    ms = _elapsed_ms(
        lambda: db.query(Booking)
        .filter(Booking.client_id == first_client.id)
        .all()
    )
    assert ms < 100, f"list bookings for client took {ms:.1f}ms (> 100ms)"


def test_active_membership_lookup(perf_db):
    """Looking up an active membership for a client must be <100ms."""
    db = perf_db
    first_client = db.query(Client).first()
    today = datetime.date.today()

    ms = _elapsed_ms(
        lambda: db.query(Membership)
        .filter(
            Membership.client_id == first_client.id,
            Membership.status == "active",
        )
        .first()
    )
    assert ms < 100, f"membership lookup took {ms:.1f}ms (> 100ms)"


def test_client_roster_for_class(perf_db):
    """Joining bookings → clients for a class roster must be <100ms."""
    db = perf_db
    first_class = db.query(ScheduledClass).first()

    ms = _elapsed_ms(
        lambda: db.query(Client)
        .join(Booking, Booking.client_id == Client.id)
        .filter(
            Booking.scheduled_class_id == first_class.id,
            Booking.status == "confirmed",
        )
        .all()
    )
    assert ms < 100, f"class roster query took {ms:.1f}ms (> 100ms)"
