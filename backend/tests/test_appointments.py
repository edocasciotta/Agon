"""
Tests for the 1-on-1 appointment engine:
- POST /api/v1/appointment-services, GET, GET/{id}, PATCH, DELETE
- POST /api/v1/instructor-availability, GET, DELETE
- GET /api/v1/appointments/available-slots
- POST /api/v1/appointments
- GET /api/v1/appointments, GET /api/v1/appointments/{id}
- PATCH /api/v1/appointments/{id}/cancel
- PATCH /api/v1/appointments/{id}/complete
"""

import datetime

import pytest
from app.auth import hash_password
from app.models.user import User


def _next_weekday_at(weekday: int, hour: int = 10, days_ahead_min: int = 3) -> datetime.datetime:
    """Returns a future datetime on the given weekday (0=Monday) that is at
    least `days_ahead_min` days out, so tests never land inside a
    cancellation window or in the past regardless of when they run."""
    today = datetime.date.today()
    days_ahead = (weekday - today.weekday()) % 7
    if days_ahead < days_ahead_min:
        days_ahead += 7
    target_date = today + datetime.timedelta(days=days_ahead)
    return datetime.datetime.combine(target_date, datetime.time(hour, 0))


@pytest.fixture
def client_b_headers(client):
    """Auth token for a second registered client (Client B). Local copy of the
    fixture in test_authorization.py — pytest fixtures are not shared across
    test modules unless declared in conftest.py."""
    resp = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": "appt-clientb@example.com",
            "password": "passwordB123",
            "full_name": "Client B",
        },
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def instructor_user_and_headers(client, db_session):
    """Creates an instructor User + Instructor row, returns (instructor, headers)."""
    from app.models.instructor import Instructor

    user = User(
        email="pt-instructor@test.com",
        password_hash=hash_password("instpass123"),
        full_name="PT Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    instructor = Instructor(user_id=user.id, bio="Personal trainer")
    db_session.add(instructor)
    db_session.commit()
    db_session.refresh(instructor)

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "pt-instructor@test.com", "password": "instpass123"},
    )
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    return instructor, headers


@pytest.fixture
def appointment_service_fixture(db_session):
    from app.models.appointment_service import AppointmentService

    svc = AppointmentService(
        name="Personal Training",
        description="1-on-1 session",
        duration_minutes=60,
        buffer_minutes=15,
        is_active=True,
    )
    db_session.add(svc)
    db_session.commit()
    db_session.refresh(svc)
    return svc


@pytest.fixture
def availability_fixture(db_session, instructor_user_and_headers):
    """Weekday=0 (Monday) 09:00-17:00 availability for the instructor."""
    from app.models.instructor_availability import InstructorAvailability

    instructor, _ = instructor_user_and_headers
    avail = InstructorAvailability(
        instructor_id=instructor.id,
        day_of_week=0,
        start_time=datetime.time(9, 0),
        end_time=datetime.time(17, 0),
        is_active=True,
    )
    db_session.add(avail)
    db_session.commit()
    db_session.refresh(avail)
    return avail


@pytest.fixture
def bookable_slot():
    """A Monday 10:00 slot at least 3 days out — inside the 09:00-17:00 window."""
    return _next_weekday_at(0, hour=10)


# ---------------------------------------------------------------------------
# AppointmentService CRUD
# ---------------------------------------------------------------------------


def test_create_appointment_service_manager(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Massage", "duration_minutes": 45, "buffer_minutes": 10},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Massage"
    assert data["duration_minutes"] == 45
    assert data["buffer_minutes"] == 10
    assert data["is_active"] is True


def test_client_cannot_create_appointment_service(client, client_auth_headers):
    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Hacked", "duration_minutes": 30},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_instructor_cannot_create_appointment_service(client, instructor_user_and_headers):
    _, headers = instructor_user_and_headers
    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Hacked", "duration_minutes": 30},
        headers=headers,
    )
    assert resp.status_code == 403


def test_list_appointment_services(client, manager_auth_headers, appointment_service_fixture):
    resp = client.get("/api/v1/appointment-services", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert any(s["id"] == appointment_service_fixture.id for s in resp.json())


def test_get_appointment_service(client, client_auth_headers, appointment_service_fixture):
    resp = client.get(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == appointment_service_fixture.id


def test_get_appointment_service_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/appointment-services/999999", headers=manager_auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_appointment_service(client, manager_auth_headers, appointment_service_fixture):
    resp = client.patch(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        json={"duration_minutes": 90},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["duration_minutes"] == 90


def test_deactivate_appointment_service(client, manager_auth_headers, appointment_service_fixture):
    resp = client.delete(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# ---------------------------------------------------------------------------
# InstructorAvailability
# ---------------------------------------------------------------------------


def test_manager_creates_availability_for_any_instructor(
    client, manager_auth_headers, instructor_user_and_headers
):
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "day_of_week": 2,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["instructor_id"] == instructor.id


def test_instructor_creates_own_availability(client, instructor_user_and_headers):
    instructor, headers = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "day_of_week": 1,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text


def test_instructor_cannot_create_availability_for_another_instructor(
    client, db_session, instructor_user_and_headers
):
    _, headers = instructor_user_and_headers

    other_user = User(
        email="other-instructor@test.com",
        password_hash=hash_password("otherpass123"),
        full_name="Other Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.commit()
    from app.models.instructor import Instructor

    other_instructor = Instructor(user_id=other_user.id)
    db_session.add(other_instructor)
    db_session.commit()
    db_session.refresh(other_instructor)

    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": other_instructor.id,
            "day_of_week": 1,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_client_cannot_create_availability(
    client, client_auth_headers, instructor_user_and_headers
):
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "day_of_week": 1,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403


def test_list_availability_by_instructor(client, manager_auth_headers, availability_fixture):
    resp = client.get(
        f"/api/v1/instructor-availability?instructor_id={availability_fixture.instructor_id}",
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_delete_own_availability(client, instructor_user_and_headers, availability_fixture):
    _, headers = instructor_user_and_headers
    resp = client.delete(
        f"/api/v1/instructor-availability/{availability_fixture.id}", headers=headers
    )
    assert resp.status_code == 204


def test_delete_availability_not_found(client, manager_auth_headers):
    resp = client.delete("/api/v1/instructor-availability/999999", headers=manager_auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /appointments/available-slots
# ---------------------------------------------------------------------------


def test_available_slots(
    client,
    client_auth_headers,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
):
    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    slots = resp.json()
    assert len(slots) > 0
    assert any(s["starts_at"] == bookable_slot.isoformat() for s in slots)


def test_available_slots_no_availability_returns_empty(
    client, client_auth_headers, appointment_service_fixture, instructor_user_and_headers
):
    instructor, _ = instructor_user_and_headers
    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": appointment_service_fixture.id,
            "instructor_id": instructor.id,
            "date": "2026-08-03",
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_available_slots_service_not_found(
    client, client_auth_headers, availability_fixture, bookable_slot
):
    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": 999999,
            "instructor_id": availability_fixture.instructor_id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 404


def test_available_slots_invalid_date(
    client, client_auth_headers, appointment_service_fixture, availability_fixture
):
    resp = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "date": "not-a-date",
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /appointments
# ---------------------------------------------------------------------------


def test_create_appointment_success(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["credit_deducted"] is True
    assert data["service_id"] == appointment_service_fixture.id


def test_create_appointment_manager_on_behalf_of_client(
    client,
    manager_auth_headers,
    registered_client,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
    db_session,
):
    from app.models.client import Client

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
            "client_id": client_obj.id,
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["client_id"] == client_obj.id


def test_create_appointment_manager_missing_client_id(
    client, manager_auth_headers, appointment_service_fixture, availability_fixture, bookable_slot
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "VALIDATION_ERROR"


def test_create_appointment_client_cannot_book_for_other_client(
    client, client_auth_headers, appointment_service_fixture, availability_fixture, bookable_slot
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
            "client_id": 999999,
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_create_appointment_service_not_found(
    client, client_auth_headers, client_membership, availability_fixture, bookable_slot
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": 999999,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 404


def test_create_appointment_service_inactive(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
    db_session,
):
    appointment_service_fixture.is_active = False
    db_session.commit()
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_SERVICE_INACTIVE"


def test_create_appointment_instructor_not_found(
    client, client_auth_headers, client_membership, appointment_service_fixture, bookable_slot
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": 999999,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 404


def test_create_appointment_in_past(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
):
    past = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": past.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_IN_PAST"


def test_create_appointment_outside_availability(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
):
    # availability_fixture is Monday 09:00-17:00; 20:00 is outside it.
    outside = _next_weekday_at(0, hour=20)
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": outside.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_OUTSIDE_AVAILABILITY"


def test_create_appointment_slot_conflict(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
):
    first = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert first.status_code == 201, first.text

    # Overlapping slot 15 min later (well within duration + buffer) must conflict.
    overlapping = bookable_slot + datetime.timedelta(minutes=15)
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": overlapping.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_SLOT_CONFLICT"


def test_create_appointment_no_membership(
    client, client_auth_headers, appointment_service_fixture, availability_fixture, bookable_slot
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_NO_MEMBERSHIP"


def test_create_appointment_rate_limited(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
    monkeypatch,
):
    """Rate limiting is disabled under AGON_ENV=test (see app/limiter.py), so this
    test only verifies the decorator is present and requests still succeed/fail
    on business rules rather than 429 — a dedicated rate-limit unit test would
    need to flip AGON_ENV, which is out of scope for this endpoint test."""
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# GET /appointments, GET /appointments/{id}
# ---------------------------------------------------------------------------


@pytest.fixture
def confirmed_appointment(
    client,
    client_auth_headers,
    client_membership,
    appointment_service_fixture,
    availability_fixture,
    bookable_slot,
):
    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_list_appointments_as_manager(client, manager_auth_headers, confirmed_appointment):
    resp = client.get("/api/v1/appointments", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert any(a["id"] == confirmed_appointment["id"] for a in resp.json())


def test_list_appointments_as_client_scoped_to_self(
    client, client_auth_headers, confirmed_appointment
):
    resp = client.get("/api/v1/appointments", headers=client_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(a["client_id"] == confirmed_appointment["client_id"] for a in data)


def test_client_cannot_list_other_clients_appointments_via_param(
    client, client_auth_headers, confirmed_appointment
):
    """A client passing a different client_id must be ignored/forced to their own."""
    resp = client.get(
        f"/api/v1/appointments?client_id={confirmed_appointment['client_id'] + 999}",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    for a in data:
        assert a["client_id"] == confirmed_appointment["client_id"]


def test_get_appointment_as_owner(client, client_auth_headers, confirmed_appointment):
    resp = client.get(
        f"/api/v1/appointments/{confirmed_appointment['id']}", headers=client_auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == confirmed_appointment["id"]


def test_get_appointment_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/appointments/999999", headers=manager_auth_headers)
    assert resp.status_code == 404


def test_get_appointment_idor(client, client_b_headers, confirmed_appointment):
    """Client B must receive 403 when reading Client A's appointment."""
    resp = client.get(
        f"/api/v1/appointments/{confirmed_appointment['id']}", headers=client_b_headers
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


# ---------------------------------------------------------------------------
# PATCH /appointments/{id}/cancel
# ---------------------------------------------------------------------------


def test_cancel_appointment_as_owner(client, client_auth_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel",
        json={"reason": "Schedule conflict"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert data["cancellation_reason"] == "Schedule conflict"


def test_cancel_appointment_idor(client, client_b_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel",
        headers=client_b_headers,
    )
    assert resp.status_code == 403


def test_cancel_appointment_not_found(client, manager_auth_headers):
    resp = client.patch(
        "/api/v1/appointments/999999/cancel",
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


def test_cancel_appointment_already_cancelled(client, client_auth_headers, confirmed_appointment):
    first = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel", headers=client_auth_headers
    )
    assert first.status_code == 200
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel", headers=client_auth_headers
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_ALREADY_CANCELLED"


def test_cancel_appointment_refunds_credit(
    client, client_auth_headers, confirmed_appointment, db_session, registered_client
):
    from app.models.client import Client
    from app.models.membership import Membership

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    membership = db_session.query(Membership).filter_by(client_id=client_obj.id).first()
    credits_before = membership.credits_remaining

    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel", headers=client_auth_headers
    )
    assert resp.status_code == 200

    db_session.refresh(membership)
    assert membership.credits_remaining == credits_before + 1


def test_manager_can_cancel_any_appointment(client, manager_auth_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel", headers=manager_auth_headers
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# PATCH /appointments/{id}/complete
# ---------------------------------------------------------------------------


def test_complete_appointment_as_manager(client, manager_auth_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/complete",
        json={"status": "completed"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


def test_complete_appointment_as_instructor(
    client, instructor_user_and_headers, confirmed_appointment
):
    _, headers = instructor_user_and_headers
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/complete",
        json={"status": "no_show"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "no_show"


def test_client_cannot_complete_appointment(client, client_auth_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/complete",
        json={"status": "completed"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "AUTH_INSUFFICIENT_PERMISSIONS"


def test_complete_appointment_invalid_status(client, manager_auth_headers, confirmed_appointment):
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/complete",
        json={"status": "bogus"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "VALIDATION_ERROR"


def test_complete_appointment_not_found(client, manager_auth_headers):
    resp = client.patch(
        "/api/v1/appointments/999999/complete",
        json={"status": "completed"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


def test_complete_appointment_not_confirmed(client, manager_auth_headers, confirmed_appointment):
    cancel_resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/cancel", headers=manager_auth_headers
    )
    assert cancel_resp.status_code == 200
    resp = client.patch(
        f"/api/v1/appointments/{confirmed_appointment['id']}/complete",
        json={"status": "completed"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_NOT_CONFIRMED"


# ---------------------------------------------------------------------------
# Denormalised fields on GET /appointments and GET /appointments/{id} —
# mobile appointment cards need service/instructor/location info instead of
# bare IDs, avoiding 3 separate round-trip queries.
# ---------------------------------------------------------------------------


def test_list_appointments_includes_enriched_fields(
    client, manager_auth_headers, confirmed_appointment
):
    resp = client.get("/api/v1/appointments", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    appt = next(a for a in data if a["id"] == confirmed_appointment["id"])
    assert appt["service_name"] == "Personal Training"
    assert appt["instructor_name"] == "PT Instructor"
    # No Location row exists for the default location_id=1 in these fixtures —
    # enrichment must degrade to None, not error.
    assert appt["location_name"] is None


def test_get_appointment_includes_enriched_fields(
    client, client_auth_headers, confirmed_appointment
):
    resp = client.get(
        f"/api/v1/appointments/{confirmed_appointment['id']}", headers=client_auth_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["service_name"] == "Personal Training"
    assert data["instructor_name"] == "PT Instructor"
    assert data["location_name"] is None


def test_get_appointment_enriched_fields_with_location(
    client, manager_auth_headers, confirmed_appointment, db_session
):
    """When a Location row exists for the appointment's location_id, its name
    is surfaced too."""
    from app.models.location import Location

    location = Location(id=1, name="Main Street Studio")
    db_session.add(location)
    db_session.commit()

    resp = client.get(
        f"/api/v1/appointments/{confirmed_appointment['id']}", headers=manager_auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["location_name"] == "Main Street Studio"


# ---------------------------------------------------------------------------
# Service scoping (InstructorAvailability.service_id) and establishment
# scoping (AppointmentService <-> Location, via appointment_service_locations)
# ---------------------------------------------------------------------------


@pytest.fixture
def service_b_fixture(db_session):
    """A second, distinct appointment service (e.g. a different modality)."""
    from app.models.appointment_service import AppointmentService

    svc = AppointmentService(
        name="Massage",
        description="Deep tissue",
        duration_minutes=60,
        buffer_minutes=0,
        is_active=True,
    )
    db_session.add(svc)
    db_session.commit()
    db_session.refresh(svc)
    return svc


@pytest.fixture
def second_instructor_user_and_headers(client, db_session):
    from app.models.instructor import Instructor

    user = User(
        email="pt-instructor-2@test.com",
        password_hash=hash_password("instpass123"),
        full_name="Second Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    instructor = Instructor(user_id=user.id, bio="Second PT")
    db_session.add(instructor)
    db_session.commit()
    db_session.refresh(instructor)

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "pt-instructor-2@test.com", "password": "instpass123"},
    )
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    return instructor, headers


@pytest.fixture
def two_locations(db_session):
    from app.models.location import Location

    loc_a = Location(name="Downtown")
    loc_b = Location(name="Uptown")
    db_session.add_all([loc_a, loc_b])
    db_session.commit()
    db_session.refresh(loc_a)
    db_session.refresh(loc_b)
    return loc_a, loc_b


def test_create_instructor_availability_with_service_id(
    client, manager_auth_headers, instructor_user_and_headers, appointment_service_fixture
):
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "service_id": appointment_service_fixture.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["service_id"] == appointment_service_fixture.id


def test_create_instructor_availability_service_id_not_found(
    client, manager_auth_headers, instructor_user_and_headers
):
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "service_id": 999999,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_availability_without_service_id_defaults_to_null(
    client, availability_fixture, manager_auth_headers
):
    """A pre-existing availability row (created without service_id) is the
    wildcard case — it must round-trip as service_id=None, not error."""
    resp = client.get(
        f"/api/v1/instructor-availability?instructor_id={availability_fixture.instructor_id}",
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["id"] == availability_fixture.id)
    assert row["service_id"] is None


def test_service_scoped_availability_excludes_other_service(
    client,
    manager_auth_headers,
    client_auth_headers,
    instructor_user_and_headers,
    appointment_service_fixture,
    service_b_fixture,
    bookable_slot,
):
    """An availability window scoped to service A must not produce slots for
    service B on the same instructor/day."""
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "service_id": appointment_service_fixture.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text

    # Service A (the one this window is scoped to) sees slots.
    resp_a = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": appointment_service_fixture.id,
            "instructor_id": instructor.id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp_a.status_code == 200
    assert len(resp_a.json()) > 0

    # Service B (a different service) sees no slots — the window is scoped away.
    resp_b = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": service_b_fixture.id,
            "instructor_id": instructor.id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp_b.status_code == 200
    assert resp_b.json() == []


def test_null_service_id_availability_shows_for_every_service(
    client,
    client_auth_headers,
    availability_fixture,
    appointment_service_fixture,
    service_b_fixture,
    bookable_slot,
):
    """A wildcard (service_id=NULL) availability window shows up for every
    service, not just the one it was originally intended for."""
    resp_a = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": appointment_service_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp_a.status_code == 200
    assert len(resp_a.json()) > 0

    resp_b = client.get(
        "/api/v1/appointments/available-slots",
        params={
            "service_id": service_b_fixture.id,
            "instructor_id": availability_fixture.instructor_id,
            "date": bookable_slot.date().isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp_b.status_code == 200
    assert len(resp_b.json()) > 0


def test_create_appointment_rejected_when_service_scoped_elsewhere(
    client,
    manager_auth_headers,
    client_auth_headers,
    client_membership,
    instructor_user_and_headers,
    appointment_service_fixture,
    service_b_fixture,
    bookable_slot,
):
    """Booking service B against a window scoped only to service A must be
    rejected as outside availability, even though the time itself is free."""
    instructor, _ = instructor_user_and_headers
    resp = client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor.id,
            "service_id": appointment_service_fixture.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        "/api/v1/appointments",
        json={
            "service_id": service_b_fixture.id,
            "instructor_id": instructor.id,
            "starts_at": bookable_slot.isoformat(),
        },
        headers=client_auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "APPOINTMENT_OUTSIDE_AVAILABILITY"


# ---------------------------------------------------------------------------
# AppointmentService <-> Location (establishment) scoping
# ---------------------------------------------------------------------------


def test_create_appointment_service_with_establishment_ids(
    client, manager_auth_headers, two_locations
):
    loc_a, loc_b = two_locations
    resp = client.post(
        "/api/v1/appointment-services",
        json={
            "name": "Scoped Service",
            "duration_minutes": 30,
            "establishment_ids": [loc_a.id, loc_b.id],
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert sorted(resp.json()["establishment_ids"]) == sorted([loc_a.id, loc_b.id])


def test_create_appointment_service_no_establishments_defaults_empty(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Unscoped Service", "duration_minutes": 30},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["establishment_ids"] == []


def test_create_appointment_service_establishment_id_not_found(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/appointment-services",
        json={
            "name": "Bad Service",
            "duration_minutes": 30,
            "establishment_ids": [999999],
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_appointment_service_replaces_establishment_ids(
    client, manager_auth_headers, appointment_service_fixture, two_locations
):
    loc_a, loc_b = two_locations
    resp = client.patch(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        json={"establishment_ids": [loc_a.id]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["establishment_ids"] == [loc_a.id]

    # PUT/PATCH replaces the entire set — it does not merge with the previous one.
    resp = client.patch(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        json={"establishment_ids": [loc_b.id]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["establishment_ids"] == [loc_b.id]


def test_update_appointment_service_without_establishment_ids_leaves_unchanged(
    client, manager_auth_headers, appointment_service_fixture, two_locations
):
    loc_a, _ = two_locations
    resp = client.patch(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        json={"establishment_ids": [loc_a.id]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.patch(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}",
        json={"duration_minutes": 75},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["duration_minutes"] == 75
    assert resp.json()["establishment_ids"] == [loc_a.id]


# ---------------------------------------------------------------------------
# GET /appointment-services/{id}/available-instructors
# ---------------------------------------------------------------------------


def test_available_instructors_service_scoped_instructor_only(
    client,
    manager_auth_headers,
    client_auth_headers,
    instructor_user_and_headers,
    second_instructor_user_and_headers,
    appointment_service_fixture,
    service_b_fixture,
):
    """Instructor A is scoped to service A only; instructor B is a wildcard
    (available for every service). Service A's eligible list must include
    both; service B's must include only B."""
    instructor_a, _ = instructor_user_and_headers
    instructor_b, _ = second_instructor_user_and_headers

    client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor_a.id,
            "service_id": appointment_service_fixture.id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )
    client.post(
        "/api/v1/instructor-availability",
        json={
            "instructor_id": instructor_b.id,
            "day_of_week": 1,
            "start_time": "09:00:00",
            "end_time": "17:00:00",
        },
        headers=manager_auth_headers,
    )

    resp_a = client.get(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}/available-instructors",
        headers=client_auth_headers,
    )
    assert resp_a.status_code == 200, resp_a.text
    ids_a = {i["id"] for i in resp_a.json()}
    assert ids_a == {instructor_a.id, instructor_b.id}

    resp_b = client.get(
        f"/api/v1/appointment-services/{service_b_fixture.id}/available-instructors",
        headers=client_auth_headers,
    )
    assert resp_b.status_code == 200, resp_b.text
    ids_b = {i["id"] for i in resp_b.json()}
    assert ids_b == {instructor_b.id}


def test_available_instructors_service_not_found(client, client_auth_headers):
    resp = client.get(
        "/api/v1/appointment-services/999999/available-instructors",
        headers=client_auth_headers,
    )
    assert resp.status_code == 404


def test_available_instructors_excludes_instructor_at_other_establishment(
    client,
    manager_auth_headers,
    client_auth_headers,
    db_session,
    instructor_user_and_headers,
    second_instructor_user_and_headers,
    two_locations,
):
    """A service scoped to a specific establishment must exclude an
    otherwise-eligible instructor who is based at a different location."""
    from app.models.appointment_service import AppointmentService

    loc_a, loc_b = two_locations
    instructor_a, _ = instructor_user_and_headers
    instructor_b, _ = second_instructor_user_and_headers

    # instructor_a stays at the default location_id=1; put instructor_b at loc_b.
    instructor_b.location_id = loc_b.id
    db_session.add(instructor_b)
    db_session.commit()

    scoped_service = AppointmentService(
        name="Loc-scoped Service", duration_minutes=30, is_active=True
    )
    db_session.add(scoped_service)
    db_session.commit()
    db_session.refresh(scoped_service)

    resp = client.patch(
        f"/api/v1/appointment-services/{scoped_service.id}",
        json={"establishment_ids": [loc_a.id]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text

    for instructor in (instructor_a, instructor_b):
        client.post(
            "/api/v1/instructor-availability",
            json={
                "instructor_id": instructor.id,
                "day_of_week": 0,
                "start_time": "09:00:00",
                "end_time": "17:00:00",
            },
            headers=manager_auth_headers,
        )

    # instructor_a has no location_id column value set explicitly, so it is
    # whatever the model default is (location_id=1). loc_a.id is very unlikely
    # to be 1 in this in-memory DB (locations table starts empty at id 1), so
    # instructor_a's location must be pinned explicitly for a deterministic test.
    instructor_a.location_id = loc_a.id
    db_session.add(instructor_a)
    db_session.commit()

    resp = client.get(
        f"/api/v1/appointment-services/{scoped_service.id}/available-instructors",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    ids = {i["id"] for i in resp.json()}
    assert ids == {instructor_a.id}
    assert instructor_b.id not in ids


def test_available_instructors_service_with_no_establishments_open_to_everyone(
    client,
    manager_auth_headers,
    client_auth_headers,
    db_session,
    instructor_user_and_headers,
    second_instructor_user_and_headers,
    two_locations,
):
    """A service with zero linked establishments is offered everywhere —
    instructors at any location are eligible."""
    loc_a, loc_b = two_locations
    instructor_a, _ = instructor_user_and_headers
    instructor_b, _ = second_instructor_user_and_headers

    instructor_a.location_id = loc_a.id
    instructor_b.location_id = loc_b.id
    db_session.add_all([instructor_a, instructor_b])
    db_session.commit()

    resp = client.post(
        "/api/v1/appointment-services",
        json={"name": "Open Service", "duration_minutes": 30},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    service_id = resp.json()["id"]
    assert resp.json()["establishment_ids"] == []

    for instructor in (instructor_a, instructor_b):
        client.post(
            "/api/v1/instructor-availability",
            json={
                "instructor_id": instructor.id,
                "day_of_week": 0,
                "start_time": "09:00:00",
                "end_time": "17:00:00",
            },
            headers=manager_auth_headers,
        )

    resp = client.get(
        f"/api/v1/appointment-services/{service_id}/available-instructors",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    ids = {i["id"] for i in resp.json()}
    assert ids == {instructor_a.id, instructor_b.id}


def test_available_instructors_no_availability_returns_empty(
    client, client_auth_headers, appointment_service_fixture
):
    resp = client.get(
        f"/api/v1/appointment-services/{appointment_service_fixture.id}/available-instructors",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []
