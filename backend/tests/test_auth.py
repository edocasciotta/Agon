"""
Tests for Phase 1 — JWT authentication and auth endpoints.
"""

# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def test_register_client_success(client):
    """POST /api/v1/auth/register/client — happy path returns 201 with tokens."""
    response = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": "newclient@example.com",
            "password": "securepassword1",
            "full_name": "New Client",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_client_duplicate_email(client):
    """POST /api/v1/auth/register/client — duplicate email returns 409."""
    payload = {
        "email": "duplicate@example.com",
        "password": "securepassword1",
        "full_name": "First Client",
    }
    r1 = client.post("/api/v1/auth/register/client", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/api/v1/auth/register/client", json=payload)
    assert r2.status_code == 409
    assert r2.json()["detail"]["error"]["code"] == "AUTH_EMAIL_ALREADY_EXISTS"


def test_register_client_password_too_short(client):
    """POST /api/v1/auth/register/client — password < 8 chars returns 422."""
    response = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": "short@example.com",
            "password": "abc",
            "full_name": "Short Password",
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


def test_login_client_success(client, registered_client):
    """POST /api/v1/auth/login — valid client credentials return 200 with tokens."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_client["email"],
            "password": registered_client["password"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_manager_success(client, manager_user):
    """POST /api/v1/auth/login — valid manager credentials return 200 with tokens."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "manager@example.com",
            "password": "managerpass123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client, registered_client):
    """POST /api/v1/auth/login — wrong password returns 401 with AUTH_INVALID_CREDENTIALS."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_client["email"],
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_INVALID_CREDENTIALS"


def test_login_wrong_email(client):
    """POST /api/v1/auth/login — nonexistent email returns 401 with AUTH_INVALID_CREDENTIALS."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "somepassword",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_INVALID_CREDENTIALS"


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


def test_refresh_token_success(client, registered_client):
    """POST /api/v1/auth/refresh — valid refresh token returns new access token."""
    refresh_token = registered_client["tokens"]["refresh_token"]
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_token_invalid(client):
    """POST /api/v1/auth/refresh — garbage token returns 401."""
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_TOKEN_INVALID"


def test_refresh_with_access_token_fails(client, registered_client):
    """POST /api/v1/auth/refresh — sending access token instead of refresh token returns 401."""
    access_token = registered_client["tokens"]["access_token"]
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_TOKEN_INVALID"


# ---------------------------------------------------------------------------
# Protected route (/me)
# ---------------------------------------------------------------------------


def test_protected_route_no_token(client):
    """GET /api/v1/auth/me — no token returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_protected_route_with_token(client, registered_client):
    """GET /api/v1/auth/me — valid token returns 200 with profile."""
    token = registered_client["tokens"]["access_token"]
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == registered_client["email"]
    assert data["role"] == "client"


def test_protected_route_with_manager_token(client, manager_auth_headers):
    """GET /api/v1/auth/me — manager token returns manager profile."""
    response = client.get("/api/v1/auth/me", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "manager"
    assert data["email"] == "manager@example.com"


def test_protected_route_invalid_token(client):
    """GET /api/v1/auth/me — invalid token returns 401."""
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Logout, forgot-password, reset-password (stubs)
# ---------------------------------------------------------------------------


def test_logout(client):
    """POST /api/v1/auth/logout — always returns 200."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200


def test_forgot_password(client):
    """POST /api/v1/auth/forgot-password — always returns 200 (stub)."""
    response = client.post("/api/v1/auth/forgot-password", json={"email": "anyone@example.com"})
    assert response.status_code == 200


def test_reset_password_invalid_token(client):
    """POST /api/v1/auth/reset-password — returns 404 for unknown token."""
    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": "sometoken",
            "new_password": "newpassword123",
        },
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Rate limit decorators — presence checks
#
# Rate limiting is disabled in AGON_ENV=test (set in conftest), so these tests
# verify the @limiter.limit decorator is present on the route (via the route
# state) without actually triggering a 429 during the test run — which would
# break other tests sharing the same limiter store.
# ---------------------------------------------------------------------------


def test_invite_endpoint_rate_limit_decorator_present():
    """GET /api/v1/auth/invite/{token} has a rate limit decorator (@limiter.limit)."""
    from app.routers.auth import router as auth_router

    # Router prefix is /api/v1/auth, so route.path already includes it.
    invite_route = None
    for route in auth_router.routes:
        if (
            hasattr(route, "path")
            and route.path == "/api/v1/auth/invite/{token}"
            and "GET" in getattr(route, "methods", set())
        ):
            invite_route = route
            break

    assert invite_route is not None, "GET /api/v1/auth/invite/{token} route not found"
    # slowapi's @limiter.limit wraps the function; __wrapped__ is set by functools.wraps
    endpoint = invite_route.endpoint
    assert (
        getattr(endpoint, "__wrapped__", None) is not None
    ), "GET /api/v1/auth/invite/{token} does not have a rate limit decorator (@limiter.limit)"


def test_reset_password_rate_limit_decorator_present():
    """POST /api/v1/auth/reset-password has a rate limit decorator (@limiter.limit)."""
    from app.routers.auth import router as auth_router

    # Router prefix is /api/v1/auth, so route.path already includes it.
    reset_password_route = None
    for route in auth_router.routes:
        if (
            hasattr(route, "path")
            and route.path == "/api/v1/auth/reset-password"
            and "POST" in getattr(route, "methods", set())
        ):
            reset_password_route = route
            break

    assert reset_password_route is not None, "POST /api/v1/auth/reset-password route not found"
    # slowapi's @limiter.limit wraps the function; __wrapped__ is set by functools.wraps
    endpoint = reset_password_route.endpoint
    assert (
        getattr(endpoint, "__wrapped__", None) is not None
    ), "POST /api/v1/auth/reset-password does not have a rate limit decorator (@limiter.limit)"
