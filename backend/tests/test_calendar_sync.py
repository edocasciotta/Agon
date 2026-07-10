"""Tests for Calendar Sync (iCal) — token generation, regeneration, and the
public .ics feed endpoint."""

from app.models.booking import Booking
from app.models.client import Client
from icalendar import Calendar

# ── Fixtures ──────────────────────────────────────────────────────────────────


def _get_client(db_session, registered_client):
    return db_session.query(Client).filter_by(email=registered_client["email"]).first()


# ── Token generation: get_or_create is idempotent ─────────────────────────────


def test_get_calendar_sync_creates_token_on_first_call(
    client, client_auth_headers, registered_client, db_session
):
    client_obj = _get_client(db_session, registered_client)
    assert client_obj.calendar_sync_token is None

    resp = client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "feed_url" in data
    assert data["feed_url"].endswith(".ics")
    assert "/api/v1/calendar/" in data["feed_url"]

    db_session.refresh(client_obj)
    assert client_obj.calendar_sync_token is not None


def test_get_calendar_sync_is_idempotent(
    client, client_auth_headers, registered_client, db_session
):
    """Calling GET twice returns the same token embedded in the feed URL."""
    client_obj = _get_client(db_session, registered_client)

    resp1 = client.get(
        f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers
    )
    resp2 = client.get(
        f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers
    )
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["feed_url"] == resp2.json()["feed_url"]


def test_get_calendar_sync_token_is_url_safe_and_long(
    client, client_auth_headers, registered_client, db_session
):
    """Token entropy source is secrets.token_urlsafe(32), not uuid4."""
    client_obj = _get_client(db_session, registered_client)
    client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers)
    db_session.refresh(client_obj)

    token_value = client_obj.calendar_sync_token
    assert token_value is not None
    # token_urlsafe(32) yields a base64-urlsafe string ~43 chars long (no
    # padding); comfortably longer and higher-entropy than a uuid4 (36 chars
    # with hyphens, only 122 bits vs. 256 bits of underlying randomness here).
    assert len(token_value) >= 40
    assert all(c.isalnum() or c in "-_" for c in token_value)


def test_manager_can_get_client_calendar_sync(
    client, manager_auth_headers, client_auth_headers, registered_client, db_session
):
    """A manager may fetch any client's calendar sync URL."""
    client_obj = _get_client(db_session, registered_client)
    resp = client.get(
        f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=manager_auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert "feed_url" in resp.json()


def test_get_calendar_sync_client_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/clients/999999/calendar-sync", headers=manager_auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "CLIENT_NOT_FOUND"


def test_get_calendar_sync_requires_auth(client, registered_client, db_session):
    client_obj = _get_client(db_session, registered_client)
    resp = client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync")
    assert resp.status_code == 401


# ── Regeneration: old token stops working, new token works ────────────────────


def test_regenerate_calendar_sync_changes_token(
    client, client_auth_headers, registered_client, db_session
):
    client_obj = _get_client(db_session, registered_client)

    first = client.get(
        f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers
    )
    first_url = first.json()["feed_url"]

    second = client.post(
        f"/api/v1/clients/{client_obj.id}/calendar-sync/regenerate", headers=client_auth_headers
    )
    assert second.status_code == 200, second.text
    second_url = second.json()["feed_url"]

    assert first_url != second_url


def test_regenerate_invalidates_old_token_on_ics_endpoint(
    client, client_auth_headers, registered_client, db_session
):
    """After regenerating, the old feed URL 404s and the new one works."""
    client_obj = _get_client(db_session, registered_client)

    first = client.get(
        f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers
    )
    old_token = first.json()["feed_url"].rsplit("/", 1)[-1].removesuffix(".ics")

    # Old token currently works.
    resp_old_before = client.get(f"/api/v1/calendar/{old_token}.ics")
    assert resp_old_before.status_code == 200

    regen = client.post(
        f"/api/v1/clients/{client_obj.id}/calendar-sync/regenerate", headers=client_auth_headers
    )
    new_token = regen.json()["feed_url"].rsplit("/", 1)[-1].removesuffix(".ics")
    assert new_token != old_token

    # Old token no longer resolves.
    resp_old_after = client.get(f"/api/v1/calendar/{old_token}.ics")
    assert resp_old_after.status_code == 404
    assert resp_old_after.json()["detail"]["error"]["code"] == "NOT_FOUND"

    # New token works.
    resp_new = client.get(f"/api/v1/calendar/{new_token}.ics")
    assert resp_new.status_code == 200


def test_regenerate_calendar_sync_client_not_found(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/clients/999999/calendar-sync/regenerate", headers=manager_auth_headers
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "CLIENT_NOT_FOUND"


# ── .ics feed: structure, filtering, headers ───────────────────────────────────


def test_ics_feed_returns_valid_calendar_structure(
    client,
    client_auth_headers,
    registered_client,
    db_session,
    confirmed_booking,
    scheduled_class_fixture,
):
    client_obj = _get_client(db_session, registered_client)
    sync = client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers)
    feed_url = sync.json()["feed_url"]
    token_value = feed_url.rsplit("/", 1)[-1].removesuffix(".ics")

    resp = client.get(f"/api/v1/calendar/{token_value}.ics")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/calendar")
    assert "agon-schedule.ics" in resp.headers["content-disposition"]

    # Round-trip parse with the icalendar package to confirm structural
    # correctness (valid RFC 5545 VCALENDAR/VEVENT).
    cal = Calendar.from_ical(resp.content)
    events = list(cal.walk("VEVENT"))
    assert len(events) == 1

    event = events[0]
    assert str(event.get("summary")) == "Yoga"
    assert event.get("status") == "CONFIRMED"
    assert str(event.get("uid")) == f"booking-{confirmed_booking.id}@agon-studio"

    dtstart = event.get("dtstart").dt
    assert dtstart.tzinfo is not None  # explicit UTC tzinfo set, not naive


def test_ics_feed_excludes_cancelled_and_no_show_bookings(
    client,
    client_auth_headers,
    registered_client,
    db_session,
    confirmed_booking,
    scheduled_class_fixture,
):
    """Only status == 'confirmed' bookings appear; cancelled/no_show are excluded."""
    client_obj = _get_client(db_session, registered_client)

    # A second scheduled class so cancelled/no_show bookings don't collide on
    # the (client_id, scheduled_class_id) unique constraint.
    import datetime

    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass

    tmpl2 = ClassTemplate(
        name="Cancelled Class",
        duration_minutes=60,
        default_capacity=10,
        color="#000000",
        is_active=True,
    )
    db_session.add(tmpl2)
    db_session.commit()
    future2 = datetime.datetime.utcnow() + datetime.timedelta(hours=48)
    sc2 = ScheduledClass(
        template_id=tmpl2.id,
        starts_at=future2,
        ends_at=future2 + datetime.timedelta(hours=1),
        capacity=10,
        status="scheduled",
    )
    db_session.add(sc2)
    db_session.commit()
    db_session.refresh(sc2)

    tmpl3 = ClassTemplate(
        name="No Show Class",
        duration_minutes=60,
        default_capacity=10,
        color="#000000",
        is_active=True,
    )
    db_session.add(tmpl3)
    db_session.commit()
    future3 = datetime.datetime.utcnow() + datetime.timedelta(hours=72)
    sc3 = ScheduledClass(
        template_id=tmpl3.id,
        starts_at=future3,
        ends_at=future3 + datetime.timedelta(hours=1),
        capacity=10,
        status="scheduled",
    )
    db_session.add(sc3)
    db_session.commit()
    db_session.refresh(sc3)

    cancelled = Booking(
        client_id=client_obj.id,
        scheduled_class_id=sc2.id,
        status="cancelled",
        credit_deducted=False,
    )
    no_show = Booking(
        client_id=client_obj.id,
        scheduled_class_id=sc3.id,
        status="no_show",
        credit_deducted=True,
    )
    db_session.add_all([cancelled, no_show])
    db_session.commit()

    sync = client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers)
    token_value = sync.json()["feed_url"].rsplit("/", 1)[-1].removesuffix(".ics")

    resp = client.get(f"/api/v1/calendar/{token_value}.ics")
    assert resp.status_code == 200
    cal = Calendar.from_ical(resp.content)
    events = list(cal.walk("VEVENT"))

    # Only the single confirmed booking (from the confirmed_booking fixture)
    # should appear — neither the cancelled nor the no_show booking.
    assert len(events) == 1
    summaries = {str(e.get("summary")) for e in events}
    assert summaries == {"Yoga"}
    assert "Cancelled Class" not in summaries
    assert "No Show Class" not in summaries


def test_ics_feed_empty_when_no_confirmed_bookings(
    client, client_auth_headers, registered_client, db_session
):
    client_obj = _get_client(db_session, registered_client)
    sync = client.get(f"/api/v1/clients/{client_obj.id}/calendar-sync", headers=client_auth_headers)
    token_value = sync.json()["feed_url"].rsplit("/", 1)[-1].removesuffix(".ics")

    resp = client.get(f"/api/v1/calendar/{token_value}.ics")
    assert resp.status_code == 200
    cal = Calendar.from_ical(resp.content)
    assert list(cal.walk("VEVENT")) == []


# ── .ics feed: invalid token ─────────────────────────────────────────────────


def test_ics_feed_invalid_token_returns_generic_404(client):
    resp = client.get("/api/v1/calendar/totally-made-up-token.ics")
    assert resp.status_code == 404
    body = resp.json()
    assert body["detail"]["error"]["code"] == "NOT_FOUND"
    # Generic message — does not distinguish malformed vs. nonexistent.
    assert "malformed" not in body["detail"]["error"]["message"].lower()


def test_ics_feed_no_auth_dependency_required(client):
    """The .ics endpoint must not require an Authorization header at all —
    the token in the path is the sole credential."""
    resp = client.get("/api/v1/calendar/some-token.ics")
    # 404 (unknown token), never 401 (no auth requirement exists to fail).
    assert resp.status_code == 404


def test_client_a_can_get_own_calendar_sync(
    client, client_auth_headers, registered_client, db_session
):
    """Sanity check: a client acting on their own client_id is allowed (not 403).

    The IDOR case (client B cannot access client A's calendar-sync) lives in
    tests/test_authorization.py per this codebase's convention of centralizing
    cross-client access-control tests there.
    """
    client_a = _get_client(db_session, registered_client)
    resp = client.get(f"/api/v1/clients/{client_a.id}/calendar-sync", headers=client_auth_headers)
    assert resp.status_code == 200


# ── Rate limiting ────────────────────────────────────────────────────────────


def test_ics_feed_has_rate_limit_decorator():
    """Verify the rate-limit decorator is present on the .ics endpoint.

    Mirrors tests/test_bookings.py::test_booking_rate_limit_disabled_in_test_env
    — rate limiting is disabled in AGON_ENV=test, so we assert the decorator
    wraps the endpoint rather than triggering a real 429 in this test run.
    """
    from app.routers.calendar_sync import router as calendar_sync_router

    ics_route = None
    for route in calendar_sync_router.routes:
        if (
            hasattr(route, "path")
            and route.path == "/api/v1/calendar/{token}.ics"
            and "GET" in getattr(route, "methods", set())
        ):
            ics_route = route
            break

    assert ics_route is not None, "GET /api/v1/calendar/{token}.ics route not found"
    endpoint = ics_route.endpoint
    assert (
        getattr(endpoint, "__wrapped__", None) is not None
    ), "GET /api/v1/calendar/{token}.ics does not have a rate limit decorator (@limiter.limit)"
