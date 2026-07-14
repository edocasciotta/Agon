"""Tests for the public Widget Schedule endpoint —
GET /api/v1/widget/{public_studio_id}/schedule (app/routers/widget.py).

No JWT is ever sent to this endpoint — it is deliberately public.
"""

import datetime

from app.auth import hash_password
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.instructor import Instructor
from app.models.scheduled_class import ScheduledClass
from app.models.studio_settings import StudioSettings
from app.models.user import User

# ── Fixtures / helpers ───────────────────────────────────────────────────────


def _make_studio_settings(db_session, **overrides):
    defaults = {
        "id": 1,
        "location_id": 1,
        "studio_name": "Test Studio",
        "primary_color": "#111111",
        "secondary_color": "#222222",
    }
    defaults.update(overrides)
    settings = StudioSettings(**defaults)
    db_session.add(settings)
    db_session.commit()
    db_session.refresh(settings)
    return settings


def _make_scheduled_class(db_session, *, location_id=1, hours_from_now=24, status="scheduled"):
    tmpl = ClassTemplate(
        name="Yoga", duration_minutes=60, default_capacity=10, color="#000000", is_active=True
    )
    db_session.add(tmpl)
    db_session.commit()
    starts_at = datetime.datetime.utcnow() + datetime.timedelta(hours=hours_from_now)
    sc = ScheduledClass(
        location_id=location_id,
        template_id=tmpl.id,
        starts_at=starts_at,
        ends_at=starts_at + datetime.timedelta(hours=1),
        capacity=10,
        status=status,
    )
    db_session.add(sc)
    db_session.commit()
    db_session.refresh(sc)
    return sc


def _make_instructor_user(db_session, *, full_name="Jane Instructor"):
    user = User(
        email=f"{full_name.replace(' ', '.').lower()}@example.com",
        password_hash=hash_password("instructorpass123"),
        full_name=full_name,
        role="instructor",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    instructor = Instructor(user_id=user.id)
    db_session.add(instructor)
    db_session.commit()
    db_session.refresh(instructor)
    return instructor, user


# ── Happy path ────────────────────────────────────────────────────────────────


def test_widget_schedule_happy_path(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    sc = _make_scheduled_class(db_session)

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["studio_name"] == "Test Studio"
    assert data["primary_color"] == "#111111"
    assert data["secondary_color"] == "#222222"
    assert len(data["classes"]) == 1
    cls = data["classes"][0]
    assert cls["scheduled_class_id"] == sc.id
    assert cls["class_name"] == "Yoga"
    assert cls["instructor_name"] is None
    assert cls["spots_available"] == 10


def test_widget_schedule_includes_instructor_name_when_present(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    instructor, user = _make_instructor_user(db_session)
    sc = _make_scheduled_class(db_session)
    sc.instructor_id = instructor.id
    db_session.add(sc)
    db_session.commit()

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    cls = resp.json()["classes"][0]
    assert cls["instructor_name"] == "Jane Instructor"


def test_widget_schedule_computes_spots_available_from_confirmed_bookings(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    sc = _make_scheduled_class(db_session)
    filler = Client(
        email="filler@example.com",
        password_hash=hash_password("pass12345"),
        full_name="Filler",
        is_active=True,
    )
    db_session.add(filler)
    db_session.commit()
    booking = Booking(client_id=filler.id, scheduled_class_id=sc.id, status="confirmed")
    db_session.add(booking)
    db_session.commit()

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    assert resp.json()["classes"][0]["spots_available"] == 9


def test_widget_schedule_cancelled_bookings_do_not_reduce_spots_available(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    sc = _make_scheduled_class(db_session)
    filler = Client(
        email="filler@example.com",
        password_hash=hash_password("pass12345"),
        full_name="Filler",
        is_active=True,
    )
    db_session.add(filler)
    db_session.commit()
    booking = Booking(client_id=filler.id, scheduled_class_id=sc.id, status="cancelled")
    db_session.add(booking)
    db_session.commit()

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    assert resp.json()["classes"][0]["spots_available"] == 10


# ── Filtering: only upcoming, non-cancelled classes ─────────────────────────


def test_widget_schedule_excludes_past_classes(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    _make_scheduled_class(db_session, hours_from_now=-24)  # already happened

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    assert resp.json()["classes"] == []


def test_widget_schedule_excludes_cancelled_classes(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    _make_scheduled_class(db_session, status="cancelled")

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    assert resp.json()["classes"] == []


# ── Unknown / malformed public_studio_id: generic 404 ───────────────────────


def test_widget_schedule_unknown_public_studio_id_returns_generic_404(client, db_session):
    _make_studio_settings(db_session)

    resp = client.get("/api/v1/widget/00000000-0000-0000-0000-000000000000/schedule")

    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_widget_schedule_malformed_public_studio_id_returns_same_generic_404(client, db_session):
    """Enumeration resistance: a syntactically-invalid id must not distinguish
    itself from a well-formed-but-unknown id (mirrors calendar_sync.py's
    token-in-path 404)."""
    _make_studio_settings(db_session)

    malformed_resp = client.get("/api/v1/widget/not-a-uuid-at-all/schedule")
    unknown_resp = client.get("/api/v1/widget/11111111-1111-1111-1111-111111111111/schedule")

    assert malformed_resp.status_code == 404
    assert unknown_resp.status_code == 404
    assert (
        malformed_resp.json()["detail"]["error"]["code"]
        == unknown_resp.json()["detail"]["error"]["code"]
        == "NOT_FOUND"
    )


# ── Data minimalism / secret exposure ───────────────────────────────────────


def test_widget_schedule_never_leaks_directory_secret_or_internal_id(client, db_session):
    studio_settings = _make_studio_settings(db_session)
    _make_scheduled_class(db_session)

    resp = client.get(f"/api/v1/widget/{studio_settings.public_studio_id}/schedule")

    assert resp.status_code == 200, resp.text
    body_text = resp.text
    assert studio_settings.directory_secret not in body_text
    data = resp.json()
    assert set(data.keys()) == {"studio_name", "primary_color", "secondary_color", "classes"}
    assert set(data["classes"][0].keys()) == {
        "scheduled_class_id",
        "class_name",
        "starts_at",
        "ends_at",
        "instructor_name",
        "spots_available",
    }


# ── Cross-studio isolation (IDOR-style, location-scoped) ────────────────────


def test_widget_schedule_does_not_leak_another_studio_location_classes(client, db_session):
    """Written as if multi-tenant (today this backend serves a single studio
    in practice, same caveat as other location_id-scoping tests in this
    codebase, e.g. test_appointments.py's establishment-scoping tests): a
    second StudioSettings row at a different location_id must never leak its
    classes into studio A's widget response, and vice versa."""
    studio_a = _make_studio_settings(db_session, id=1, location_id=1, studio_name="Studio A")
    studio_b = _make_studio_settings(db_session, id=2, location_id=2, studio_name="Studio B")

    class_a = _make_scheduled_class(db_session, location_id=1)
    class_b = _make_scheduled_class(db_session, location_id=2)

    resp_a = client.get(f"/api/v1/widget/{studio_a.public_studio_id}/schedule")
    resp_b = client.get(f"/api/v1/widget/{studio_b.public_studio_id}/schedule")

    assert resp_a.status_code == 200, resp_a.text
    assert resp_b.status_code == 200, resp_b.text

    ids_a = {c["scheduled_class_id"] for c in resp_a.json()["classes"]}
    ids_b = {c["scheduled_class_id"] for c in resp_b.json()["classes"]}

    assert ids_a == {class_a.id}
    assert ids_b == {class_b.id}
    assert resp_a.json()["studio_name"] == "Studio A"
    assert resp_b.json()["studio_name"] == "Studio B"


def test_widget_schedule_public_studio_id_is_never_the_internal_integer_id(client, db_session):
    """public_studio_id must be a UUID string, and the internal integer id
    must not itself resolve the endpoint."""
    studio_settings = _make_studio_settings(db_session)

    resp_by_internal_id = client.get(f"/api/v1/widget/{studio_settings.id}/schedule")

    assert resp_by_internal_id.status_code == 404
    assert len(studio_settings.public_studio_id) > len(str(studio_settings.id))


# ── Rate limiting ────────────────────────────────────────────────────────────


def test_widget_schedule_has_rate_limit_decorator():
    """Verify the rate-limit decorator is present on the widget endpoint.

    Mirrors tests/test_calendar_sync.py::test_ics_feed_has_rate_limit_decorator
    — rate limiting is disabled in AGON_ENV=test, so we assert the decorator
    wraps the endpoint rather than triggering a real 429 in this test run.
    """
    from app.routers.widget import router as widget_router

    schedule_route = None
    for route in widget_router.routes:
        if (
            hasattr(route, "path")
            and route.path == "/api/v1/widget/{public_studio_id}/schedule"
            and "GET" in getattr(route, "methods", set())
        ):
            schedule_route = route
            break

    assert schedule_route is not None, "GET /api/v1/widget/{public_studio_id}/schedule not found"
    endpoint = schedule_route.endpoint
    assert (
        getattr(endpoint, "__wrapped__", None) is not None
    ), "widget schedule endpoint does not have a rate limit decorator (@limiter.limit)"


# ── StudioSettingsResponse exposes public_studio_id, not directory_secret ──


def test_studio_settings_response_exposes_public_studio_id_not_directory_secret(
    client, manager_auth_headers, db_session
):
    studio_settings = _make_studio_settings(db_session)

    resp = client.get("/api/v1/studio", headers=manager_auth_headers)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["public_studio_id"] == studio_settings.public_studio_id
    assert "directory_secret" not in data
    assert studio_settings.directory_secret not in resp.text
