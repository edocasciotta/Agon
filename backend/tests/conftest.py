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
