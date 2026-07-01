"""
End-to-end integration test for the full booking lifecycle.

This test drives every step exclusively via HTTP calls through the FastAPI
TestClient, touching the database only through the fixtures that set up
prerequisite objects (membership, client).  Each assertion carries a
descriptive message so failures are immediately self-explanatory.

Flow covered:
  1. Manager creates a class template      POST /api/v1/class-templates
  2. Manager schedules a class              POST /api/v1/classes
  3. Client membership already set up via  `client_membership` fixture
  4. Client books the class                POST /api/v1/bookings
  5. Client reads the booking              GET  /api/v1/bookings/{id}
  6. Manager reads the membership          GET  /api/v1/memberships/{id}  → credits_remaining -1
  7. Manager does check-in for the client  POST /api/v1/checkins
  8. Manager lists check-ins for the class GET  /api/v1/checkins/class/{id}
  9. Client cancels the booking            DELETE /api/v1/bookings/{id}
 10. Manager reads the membership          GET  /api/v1/memberships/{id}  → credits_remaining restored
"""

import datetime
import pytest


def test_full_booking_flow(
    client,
    db_session,
    manager_auth_headers,
    client_auth_headers,
    client_membership,
    registered_client,
):
    # -----------------------------------------------------------------------
    # Step 1 — Manager creates a class template via API
    # -----------------------------------------------------------------------
    tmpl_resp = client.post(
        "/api/v1/class-templates",
        json={
            "name": "E2E Yoga",
            "duration_minutes": 60,
            "default_capacity": 10,
            "color": "#FF5733",
        },
        headers=manager_auth_headers,
    )
    assert tmpl_resp.status_code == 201, f"Step 1 – create template failed: {tmpl_resp.json()}"
    template_id = tmpl_resp.json()["id"]
    assert template_id is not None, "Step 1 – template id is None"

    # -----------------------------------------------------------------------
    # Step 2 — Manager schedules a class starting in 10 minutes
    #
    # The class is deliberately set to start in 10 minutes so that the
    # default 15-minute check-in window (before class starts) is open when
    # step 7 runs.  A 24-hour-future class would cause CHECKIN_WINDOW_NOT_OPEN.
    # -----------------------------------------------------------------------
    future = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    ends_at = future + datetime.timedelta(hours=1)

    class_resp = client.post(
        "/api/v1/classes",
        json={
            "template_id": template_id,
            "starts_at": future.isoformat(),
            "ends_at": ends_at.isoformat(),
            "capacity": 10,
        },
        headers=manager_auth_headers,
    )
    assert class_resp.status_code == 201, f"Step 2 – schedule class failed: {class_resp.json()}"
    class_data = class_resp.json()
    scheduled_class_id = class_data["id"]
    assert class_data["status"] == "scheduled", (
        f"Step 2 – class status is not 'scheduled': {class_data['status']}"
    )

    # -----------------------------------------------------------------------
    # Step 3 — Membership already active (provided by `client_membership` fixture)
    #
    # The fixture gives the registered client 5 credits on an active membership.
    # We record the initial credit balance for comparison in later steps.
    # -----------------------------------------------------------------------
    initial_credits_resp = client.get(
        f"/api/v1/memberships/{client_membership.id}",
        headers=manager_auth_headers,
    )
    assert initial_credits_resp.status_code == 200, (
        f"Step 3 – read membership failed: {initial_credits_resp.json()}"
    )
    initial_credits = initial_credits_resp.json()["credits_remaining"]
    assert initial_credits == 5, (
        f"Step 3 – expected 5 initial credits, got {initial_credits}"
    )

    # -----------------------------------------------------------------------
    # Step 4 — Client books the class via API
    # -----------------------------------------------------------------------
    booking_resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_id},
        headers=client_auth_headers,
    )
    assert booking_resp.status_code == 201, f"Step 4 – create booking failed: {booking_resp.json()}"
    booking_data = booking_resp.json()
    booking_id = booking_data["id"]
    assert booking_data["status"] == "confirmed", (
        f"Step 4 – booking status is not 'confirmed': {booking_data['status']}"
    )
    assert booking_data["credit_deducted"] is True, (
        "Step 4 – credit_deducted should be True when a membership is active"
    )

    # -----------------------------------------------------------------------
    # Step 5 — Client reads the booking to confirm it exists
    # -----------------------------------------------------------------------
    get_booking_resp = client.get(
        f"/api/v1/bookings/{booking_id}",
        headers=client_auth_headers,
    )
    assert get_booking_resp.status_code == 200, (
        f"Step 5 – get booking failed: {get_booking_resp.json()}"
    )
    assert get_booking_resp.json()["id"] == booking_id, (
        f"Step 5 – returned booking id mismatch: {get_booking_resp.json()['id']} != {booking_id}"
    )

    # -----------------------------------------------------------------------
    # Step 6 — Verify that one credit was deducted after booking
    # -----------------------------------------------------------------------
    after_booking_credits_resp = client.get(
        f"/api/v1/memberships/{client_membership.id}",
        headers=manager_auth_headers,
    )
    assert after_booking_credits_resp.status_code == 200, (
        f"Step 6 – read membership after booking failed: {after_booking_credits_resp.json()}"
    )
    credits_after_booking = after_booking_credits_resp.json()["credits_remaining"]
    assert credits_after_booking == initial_credits - 1, (
        f"Step 6 – expected credits_remaining={initial_credits - 1}, "
        f"got {credits_after_booking}"
    )

    # -----------------------------------------------------------------------
    # Step 7 — Manager performs a manual check-in for the client
    #
    # The class starts in 10 minutes, which is inside the 15-minute default
    # check-in window, so this request must succeed.
    # -----------------------------------------------------------------------
    from app.models.client import Client as ClientModel
    client_obj = db_session.query(ClientModel).filter_by(
        email=registered_client["email"]
    ).first()
    assert client_obj is not None, "Step 7 – client not found in DB"

    checkin_resp = client.post(
        "/api/v1/checkins",
        json={
            "method": "manual",
            "scheduled_class_id": scheduled_class_id,
            "client_id": client_obj.id,
        },
        headers=manager_auth_headers,
    )
    assert checkin_resp.status_code == 201, (
        f"Step 7 – check-in failed: {checkin_resp.json()}"
    )
    checkin_data = checkin_resp.json()
    assert checkin_data["method"] == "manual", (
        f"Step 7 – check-in method is not 'manual': {checkin_data['method']}"
    )
    assert checkin_data["booking_id"] == booking_id, (
        f"Step 7 – check-in booking_id mismatch: {checkin_data['booking_id']} != {booking_id}"
    )

    # -----------------------------------------------------------------------
    # Step 8 — Manager lists check-ins for the class; the client must appear
    # -----------------------------------------------------------------------
    list_checkins_resp = client.get(
        f"/api/v1/checkins/class/{scheduled_class_id}",
        headers=manager_auth_headers,
    )
    assert list_checkins_resp.status_code == 200, (
        f"Step 8 – list checkins failed: {list_checkins_resp.json()}"
    )
    checkins_list = list_checkins_resp.json()
    assert isinstance(checkins_list, list), "Step 8 – expected a list of check-ins"
    assert len(checkins_list) >= 1, "Step 8 – no check-ins found for the class"
    assert any(c["booking_id"] == booking_id for c in checkins_list), (
        f"Step 8 – the expected booking_id={booking_id} is not in the check-ins list: {checkins_list}"
    )

    # -----------------------------------------------------------------------
    # Step 9 — Client cancels the booking via API
    # -----------------------------------------------------------------------
    cancel_resp = client.delete(
        f"/api/v1/bookings/{booking_id}",
        headers=client_auth_headers,
    )
    assert cancel_resp.status_code == 200, (
        f"Step 9 – cancel booking failed: {cancel_resp.json()}"
    )
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "cancelled", (
        f"Step 9 – booking status after cancel is not 'cancelled': {cancel_data['status']}"
    )

    # -----------------------------------------------------------------------
    # Step 10 — Verify the credit was refunded after cancellation
    #
    # The class starts in 10 minutes, which is within the default 2-hour
    # cancellation window when no StudioSettings are configured.  The
    # default behaviour (no StudioSettings row) does NOT deduct credit on
    # late cancel, so the credit IS refunded.
    # -----------------------------------------------------------------------
    after_cancel_credits_resp = client.get(
        f"/api/v1/memberships/{client_membership.id}",
        headers=manager_auth_headers,
    )
    assert after_cancel_credits_resp.status_code == 200, (
        f"Step 10 – read membership after cancel failed: {after_cancel_credits_resp.json()}"
    )
    credits_after_cancel = after_cancel_credits_resp.json()["credits_remaining"]
    assert credits_after_cancel == initial_credits, (
        f"Step 10 – expected credits_remaining={initial_credits} after refund, "
        f"got {credits_after_cancel}"
    )
