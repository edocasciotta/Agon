import pytest
import app.models  # noqa — registers all models with Base.metadata
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from main import app


@pytest.fixture(scope="function")
def test_engine():
    # StaticPool keeps a single shared connection so all sessions see the
    # same in-memory SQLite database — required for in-memory isolation.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def registered_client(client):
    """Creates a registered client and returns their credentials."""
    response = client.post("/api/v1/auth/register/client", json={
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test Client"
    })
    assert response.status_code == 201
    return {"email": "test@example.com", "password": "testpassword123", "tokens": response.json()}


@pytest.fixture
def client_auth_headers(registered_client):
    """Returns Authorization headers for a registered client."""
    token = registered_client["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_user(db_session):
    """Creates a manager user directly in DB."""
    from app.models.user import User
    from app.auth import hash_password
    user = User(
        email="manager@example.com",
        password_hash=hash_password("managerpass123"),
        full_name="Studio Manager",
        role="manager",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def manager_auth_headers(client, manager_user):
    """Returns Authorization headers for the manager user."""
    response = client.post("/api/v1/auth/login", json={
        "email": "manager@example.com",
        "password": "managerpass123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def membership_type(db_session):
    from app.models.membership_type import MembershipType
    mt = MembershipType(
        name="10-Class Pack",
        type="credit_pack",
        price=100.0,
        credits_included=10,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def client_membership(db_session, registered_client, membership_type):
    """Gives the registered client an active membership with 5 credits."""
    from app.models.membership import Membership
    from app.models.client import Client
    import datetime
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    m = Membership(
        client_id=client_obj.id,
        membership_type_id=membership_type.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=5,
        credits_used=0,
    )
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    return m


@pytest.fixture
def scheduled_class_fixture(db_session, manager_user):
    """Creates a scheduled class in the future."""
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass
    import datetime
    tmpl = ClassTemplate(name="Yoga", duration_minutes=60, default_capacity=10, color="#000000", is_active=True)
    db_session.add(tmpl)
    db_session.commit()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        capacity=10,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.commit()
    db_session.refresh(sc)
    return sc


@pytest.fixture
def confirmed_booking(db_session, registered_client, client_membership, scheduled_class_fixture):
    """Creates a confirmed booking for the registered_client on scheduled_class_fixture."""
    from app.models.booking import Booking
    from app.models.client import Client
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    b = Booking(
        client_id=client_obj.id,
        scheduled_class_id=scheduled_class_fixture.id,
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


@pytest.fixture
def full_class_fixture(db_session, manager_user):
    """Creates a scheduled class with capacity=1, already full."""
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass
    from app.models.booking import Booking
    from app.models.client import Client
    from app.auth import hash_password
    import datetime
    tmpl = ClassTemplate(name="Pilates", duration_minutes=45, default_capacity=1, color="#000000", is_active=True)
    db_session.add(tmpl)
    db_session.commit()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        capacity=1,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.commit()
    # Add a different client to fill the spot
    filler = Client(email="filler@example.com", password_hash=hash_password("pass12345"), full_name="Filler", is_active=True)
    db_session.add(filler)
    db_session.commit()
    b = Booking(client_id=filler.id, scheduled_class_id=sc.id, status="confirmed", credit_deducted=False)
    db_session.add(b)
    db_session.commit()
    db_session.refresh(sc)
    return sc
