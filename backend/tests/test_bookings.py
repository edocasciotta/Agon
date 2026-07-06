"""
Tests for the booking engine (Phase 3):
- POST /api/v1/bookings
- GET /api/v1/bookings
- GET /api/v1/bookings/{id}
- DELETE /api/v1/bookings/{id}
- POST /api/v1/bookings/waitlist
- DELETE /api/v1/bookings/waitlist/{id}
- POST /api/v1/bookings/waitlist/{id}/confirm
"""

import datetime

# ---------------------------------------------------------------------------
# Helper to get client id from registered_client fixture
# ---------------------------------------------------------------------------


def _get_client_id(db_session, email):
    from app.models.client import Client

    return db_session.query(Client).filter_by(email=email).first().id


# ---------------------------------------------------------------------------
# 1. test_create_booking_success
# ---------------------------------------------------------------------------


def test_create_booking_success(
    client, client_auth_headers, client_membership, scheduled_class_fixture, db_session
):
    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["credit_deducted"] is True


# ---------------------------------------------------------------------------
# 2. test_create_booking_no_membership
# ---------------------------------------------------------------------------


def test_create_booking_no_membership(client, client_auth_headers, scheduled_class_fixture):
    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_NO_MEMBERSHIP"


# ---------------------------------------------------------------------------
# 3. test_create_booking_guest_allowed
# ---------------------------------------------------------------------------


def test_create_booking_guest_allowed(
    client, client_auth_headers, scheduled_class_fixture, db_session
):
    from app.models.studio_settings import StudioSettings

    settings = StudioSettings(
        id=1,
        studio_name="Test Studio",
        guest_bookings_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "confirmed"
    # No membership → no credit deducted
    assert data["credit_deducted"] is False


# ---------------------------------------------------------------------------
# 4. test_create_booking_class_full
# ---------------------------------------------------------------------------


def test_create_booking_class_full(
    client, client_auth_headers, client_membership, full_class_fixture
):
    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": full_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_CLASS_FULL"


# ---------------------------------------------------------------------------
# 5. test_create_booking_duplicate
# ---------------------------------------------------------------------------


def test_create_booking_duplicate(
    client, client_auth_headers, client_membership, scheduled_class_fixture
):
    # First booking
    resp1 = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp1.status_code == 201

    # Second booking for same class
    resp2 = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp2.status_code == 409, resp2.text
    assert resp2.json()["detail"]["error"]["code"] == "BOOKING_DUPLICATE"


# ---------------------------------------------------------------------------
# 6. test_create_booking_class_not_scheduled
# ---------------------------------------------------------------------------


def test_create_booking_class_not_scheduled(
    client, client_auth_headers, client_membership, scheduled_class_fixture, db_session
):
    # Cancel the class
    scheduled_class_fixture.status = "cancelled"
    db_session.commit()

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_CLASS_NOT_SCHEDULED"


# ---------------------------------------------------------------------------
# 7. test_list_bookings_as_manager
# ---------------------------------------------------------------------------


def test_list_bookings_as_manager(
    client,
    manager_auth_headers,
    client_auth_headers,
    client_membership,
    scheduled_class_fixture,
    db_session,
):
    # Client creates a booking
    client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )

    resp = client.get("/api/v1/bookings", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) >= 1


# ---------------------------------------------------------------------------
# 8. test_list_bookings_as_client
# ---------------------------------------------------------------------------


def test_list_bookings_as_client(
    client,
    client_auth_headers,
    manager_auth_headers,
    client_membership,
    scheduled_class_fixture,
    db_session,
    registered_client,
):
    from app.auth import hash_password
    from app.models.client import Client

    # Create another client with a booking
    other = Client(
        email="other@example.com",
        password_hash=hash_password("pass12345"),
        full_name="Other",
        is_active=True,
    )
    db_session.add(other)
    db_session.commit()

    # Create a second class for the other client
    from app.models.booking import Booking
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass

    tmpl = ClassTemplate(
        name="Spin", duration_minutes=45, default_capacity=5, color="#111111", is_active=True
    )
    db_session.add(tmpl)
    db_session.commit()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=48)
    sc2 = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        capacity=5,
        status="scheduled",
    )
    db_session.add(sc2)
    db_session.commit()
    other_booking = Booking(
        client_id=other.id, scheduled_class_id=sc2.id, status="confirmed", credit_deducted=False
    )
    db_session.add(other_booking)
    db_session.commit()

    # Client books their own class
    client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )

    resp = client.get("/api/v1/bookings", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # Client should only see their own booking
    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    for b in data:
        assert b["client_id"] == client_obj.id


# ---------------------------------------------------------------------------
# 9. test_get_booking_as_owner
# ---------------------------------------------------------------------------


def test_get_booking_as_owner(
    client, client_auth_headers, client_membership, scheduled_class_fixture
):
    create_resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert create_resp.status_code == 201
    booking_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/bookings/{booking_id}", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == booking_id


# ---------------------------------------------------------------------------
# 10. test_get_booking_forbidden
# ---------------------------------------------------------------------------


def test_get_booking_forbidden(client, client_auth_headers, db_session):
    from app.auth import hash_password
    from app.models.booking import Booking
    from app.models.class_template import ClassTemplate
    from app.models.client import Client
    from app.models.scheduled_class import ScheduledClass

    # Create another client's booking
    other = Client(
        email="other2@example.com",
        password_hash=hash_password("pass12345"),
        full_name="Other2",
        is_active=True,
    )
    db_session.add(other)
    db_session.commit()

    tmpl = ClassTemplate(
        name="Zumba", duration_minutes=60, default_capacity=5, color="#222222", is_active=True
    )
    db_session.add(tmpl)
    db_session.commit()
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=48)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=future,
        ends_at=future + datetime.timedelta(hours=1),
        capacity=5,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.commit()
    booking = Booking(
        client_id=other.id, scheduled_class_id=sc.id, status="confirmed", credit_deducted=False
    )
    db_session.add(booking)
    db_session.commit()

    resp = client.get(f"/api/v1/bookings/{booking.id}", headers=client_auth_headers)
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# 11. test_cancel_booking_success (credit refunded)
# ---------------------------------------------------------------------------


def test_cancel_booking_success(
    client, client_auth_headers, client_membership, scheduled_class_fixture, db_session
):
    # Book
    create_resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert create_resp.status_code == 201
    booking_id = create_resp.json()["id"]
    assert create_resp.json()["credit_deducted"] is True

    # Check credits before cancel

    db_session.refresh(client_membership)
    credits_before = client_membership.credits_remaining

    # Cancel (class is 24h in future — not late)
    resp = client.delete(f"/api/v1/bookings/{booking_id}", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"

    db_session.refresh(client_membership)
    # Credit should be refunded
    assert client_membership.credits_remaining == credits_before + 1


# ---------------------------------------------------------------------------
# 12. test_cancel_booking_late_no_refund
# ---------------------------------------------------------------------------


def test_cancel_booking_late_no_refund(client, client_auth_headers, db_session, registered_client):
    from app.models.booking import Booking
    from app.models.class_template import ClassTemplate
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType
    from app.models.scheduled_class import ScheduledClass
    from app.models.studio_settings import StudioSettings

    # Studio settings: 48h cancellation window, credit is deducted on late cancel
    settings = StudioSettings(
        id=1,
        studio_name="Test Studio",
        cancellation_hours=48,
        cancellation_deducts_credit=True,
    )
    db_session.add(settings)
    db_session.commit()

    # Create a membership type and membership
    mt = MembershipType(
        name="Pack", type="credit_pack", price=50.0, credits_included=5, is_active=True
    )
    db_session.add(mt)
    db_session.commit()

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    membership = Membership(
        client_id=client_obj.id,
        membership_type_id=mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=3,
        credits_used=0,
    )
    db_session.add(membership)
    db_session.commit()

    # Class starting in 1 hour (within 48h window = late)
    tmpl = ClassTemplate(
        name="Late Class", duration_minutes=60, default_capacity=5, color="#333333", is_active=True
    )
    db_session.add(tmpl)
    db_session.commit()
    soon = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    sc = ScheduledClass(
        template_id=tmpl.id,
        starts_at=soon,
        ends_at=soon + datetime.timedelta(hours=1),
        capacity=5,
        status="scheduled",
    )
    db_session.add(sc)
    db_session.commit()

    # Create booking with credit_deducted=True
    booking = Booking(
        client_id=client_obj.id,
        scheduled_class_id=sc.id,
        status="confirmed",
        credit_deducted=True,
    )
    db_session.add(booking)
    db_session.commit()

    credits_before = membership.credits_remaining

    # Cancel as client (late cancellation)
    resp = client.delete(f"/api/v1/bookings/{booking.id}", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"

    db_session.refresh(membership)
    # Credit should NOT be refunded
    assert membership.credits_remaining == credits_before


# ---------------------------------------------------------------------------
# 13. test_cancel_booking_already_cancelled
# ---------------------------------------------------------------------------


def test_cancel_booking_already_cancelled(
    client, client_auth_headers, client_membership, scheduled_class_fixture
):
    # Book
    create_resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert create_resp.status_code == 201
    booking_id = create_resp.json()["id"]

    # Cancel once
    client.delete(f"/api/v1/bookings/{booking_id}", headers=client_auth_headers)

    # Cancel again
    resp = client.delete(f"/api/v1/bookings/{booking_id}", headers=client_auth_headers)
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_ALREADY_CANCELLED"


# ---------------------------------------------------------------------------
# 14. test_join_waitlist_success
# ---------------------------------------------------------------------------


def test_join_waitlist_success(client, client_auth_headers, client_membership, full_class_fixture):
    resp = client.post(
        "/api/v1/bookings/waitlist",
        json={"scheduled_class_id": full_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "waiting"
    assert (
        data["position"] == 1
    )  # first waitlist entry (filler has a booking, not a waitlist entry)


# ---------------------------------------------------------------------------
# 15. test_join_waitlist_duplicate
# ---------------------------------------------------------------------------


def test_join_waitlist_duplicate(
    client, client_auth_headers, client_membership, full_class_fixture
):
    # Join waitlist
    client.post(
        "/api/v1/bookings/waitlist",
        json={"scheduled_class_id": full_class_fixture.id},
        headers=client_auth_headers,
    )

    # Try again
    resp = client.post(
        "/api/v1/bookings/waitlist",
        json={"scheduled_class_id": full_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_WAITLIST_DUPLICATE"


# ---------------------------------------------------------------------------
# 16. test_leave_waitlist
# ---------------------------------------------------------------------------


def test_leave_waitlist(client, client_auth_headers, client_membership, full_class_fixture):
    join_resp = client.post(
        "/api/v1/bookings/waitlist",
        json={"scheduled_class_id": full_class_fixture.id},
        headers=client_auth_headers,
    )
    assert join_resp.status_code == 201
    waitlist_id = join_resp.json()["id"]

    resp = client.delete(f"/api/v1/bookings/waitlist/{waitlist_id}", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "declined"


# ---------------------------------------------------------------------------
# 17. test_confirm_waitlist_offer
# ---------------------------------------------------------------------------


def test_confirm_waitlist_offer(
    client,
    client_auth_headers,
    client_membership,
    full_class_fixture,
    db_session,
    registered_client,
):
    from app.models.client import Client
    from app.models.waitlist import Waitlist

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    # Manually create an "offered" waitlist entry
    entry = Waitlist(
        client_id=client_obj.id,
        scheduled_class_id=full_class_fixture.id,
        position=2,
        status="offered",
        offered_at=datetime.datetime.utcnow(),
        offer_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=30),
    )
    db_session.add(entry)
    db_session.commit()

    # Free up a spot: cancel the filler's booking
    from app.models.booking import Booking

    filler_booking = (
        db_session.query(Booking)
        .filter_by(scheduled_class_id=full_class_fixture.id, status="confirmed")
        .first()
    )
    filler_booking.status = "cancelled"
    db_session.commit()

    resp = client.post(
        f"/api/v1/bookings/waitlist/{entry.id}/confirm",
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "confirmed"


# ---------------------------------------------------------------------------
# 18. test_confirm_waitlist_expired
# ---------------------------------------------------------------------------


def test_confirm_waitlist_expired(
    client, client_auth_headers, full_class_fixture, db_session, registered_client
):
    from app.models.client import Client
    from app.models.waitlist import Waitlist

    client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    # Create an expired waitlist offer
    entry = Waitlist(
        client_id=client_obj.id,
        scheduled_class_id=full_class_fixture.id,
        position=2,
        status="offered",
        offered_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1),
        offer_expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=5),
    )
    db_session.add(entry)
    db_session.commit()

    resp = client.post(
        f"/api/v1/bookings/waitlist/{entry.id}/confirm",
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAITLIST_OFFER_EXPIRED"


# 19. test_booking_rate_limit_is_enforced_in_production_mode
# ---------------------------------------------------------------------------


def test_booking_rate_limit_disabled_in_test_env(
    client, client_auth_headers, client_membership, scheduled_class_fixture, db_session
):
    """Rate limiting is disabled in AGON_ENV=test (set in conftest).

    This test verifies that the rate-limit decorator is present on the endpoint
    (by checking the route state) without actually triggering a 429 during the
    test run — which would break other tests sharing the same limiter store.
    """
    from app.routers.bookings import router as bookings_router

    # Find the POST /api/v1/bookings route (router prefix is /api/v1)
    post_booking_route = None
    for route in bookings_router.routes:
        if (
            hasattr(route, "path")
            and route.path == "/api/v1/bookings"
            and "POST" in getattr(route, "methods", set())
        ):
            post_booking_route = route
            break

    assert post_booking_route is not None, "POST /api/v1/bookings route not found"
    # slowapi's @limiter.limit wraps the function; __wrapped__ is set by functools.wraps
    endpoint = post_booking_route.endpoint
    assert (
        getattr(endpoint, "__wrapped__", None) is not None
    ), "POST /api/v1/bookings does not have a rate limit decorator (@limiter.limit)"


# ---------------------------------------------------------------------------
# Manager override: past classes
# ---------------------------------------------------------------------------


def test_create_booking_already_started_blocks_client(
    client, client_auth_headers, client_membership, scheduled_class_fixture, db_session
):
    """Clients cannot book a class that has already started."""
    from app.utils import utcnow
    scheduled_class_fixture.starts_at = utcnow() - datetime.timedelta(hours=1)
    db_session.commit()

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["error"]["code"] == "BOOKING_CLASS_ALREADY_STARTED"


def test_manager_can_book_already_started_class(
    client, manager_auth_headers, registered_client, client_membership,
    scheduled_class_fixture, db_session
):
    """Managers can retroactively book a client into a class that has already started."""
    from app.utils import utcnow
    from app.models.client import Client
    scheduled_class_fixture.starts_at = utcnow() - datetime.timedelta(hours=1)
    db_session.commit()

    client_obj = db_session.query(Client).filter_by(email="test@example.com").first()
    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id, "client_id": client_obj.id},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "confirmed"
