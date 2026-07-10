"""
Tests for Waivers / digital signatures:
- POST /api/v1/waivers                          (manager CRUD)
- GET /api/v1/waivers
- GET /api/v1/waivers/{id}
- PUT /api/v1/waivers/{id}
- DELETE /api/v1/waivers/{id}                    (soft-delete)
- GET /api/v1/clients/{client_id}/waivers        (client-self or manager)
- POST /api/v1/waivers/{waiver_id}/sign          (client-self only)
- Booking enforcement (app/routers/bookings.py::create_booking)
"""


def _get_client_id(db_session, email):
    from app.models.client import Client

    return db_session.query(Client).filter_by(email=email).first().id


def _create_waiver(client, manager_auth_headers, **overrides):
    payload = {
        "title": "Liability Waiver",
        "body": "I agree to assume all risk of injury.",
        "requires_before_booking": False,
    }
    payload.update(overrides)
    resp = client.post("/api/v1/waivers", json=payload, headers=manager_auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Manager CRUD — happy path
# ---------------------------------------------------------------------------


def test_create_waiver_success(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/waivers",
        json={
            "title": "Liability Waiver",
            "body": "I assume all risk.",
            "requires_before_booking": True,
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["title"] == "Liability Waiver"
    assert data["body"] == "I assume all risk."
    assert data["version"] == 1
    assert data["requires_before_booking"] is True
    assert data["is_active"] is True
    assert data["location_id"] == 1


def test_create_waiver_defaults_requires_before_booking_false(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/waivers",
        json={"title": "Health Questionnaire", "body": "Please answer honestly."},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["requires_before_booking"] is False


def test_list_waivers(client, manager_auth_headers):
    _create_waiver(client, manager_auth_headers, title="Waiver A")
    _create_waiver(client, manager_auth_headers, title="Waiver B")

    resp = client.get("/api/v1/waivers", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    titles = {w["title"] for w in resp.json()}
    assert {"Waiver A", "Waiver B"}.issubset(titles)


def test_list_waivers_active_only(client, manager_auth_headers):
    active = _create_waiver(client, manager_auth_headers, title="Active Waiver")
    inactive = _create_waiver(client, manager_auth_headers, title="Inactive Waiver")
    client.delete(f"/api/v1/waivers/{inactive['id']}", headers=manager_auth_headers)

    resp = client.get("/api/v1/waivers?active_only=true", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    ids = {w["id"] for w in resp.json()}
    assert active["id"] in ids
    assert inactive["id"] not in ids


def test_get_waiver_success(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    resp = client.get(f"/api/v1/waivers/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == created["id"]


def test_update_waiver_title_only(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"title": "Renamed Waiver"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["title"] == "Renamed Waiver"
    assert data["version"] == 1  # unchanged


def test_deactivate_waiver_success(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    resp = client.delete(f"/api/v1/waivers/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_active"] is False
    assert data["id"] == created["id"]

    # Confirm it's a soft-delete: still retrievable by ID (mirrors promo_codes).
    resp = client.get(f"/api/v1/waivers/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# ---------------------------------------------------------------------------
# Manager CRUD — error paths
# ---------------------------------------------------------------------------


def test_get_waiver_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/waivers/99999", headers=manager_auth_headers)
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAIVER_NOT_FOUND"


def test_update_waiver_not_found(client, manager_auth_headers):
    resp = client.put("/api/v1/waivers/99999", json={"title": "Nope"}, headers=manager_auth_headers)
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAIVER_NOT_FOUND"


def test_deactivate_waiver_not_found(client, manager_auth_headers):
    resp = client.delete("/api/v1/waivers/99999", headers=manager_auth_headers)
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAIVER_NOT_FOUND"


def test_create_waiver_client_forbidden(client, client_auth_headers):
    resp = client.post(
        "/api/v1/waivers",
        json={"title": "Nope", "body": "Nope"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 403, resp.text


def test_list_waivers_client_forbidden(client, client_auth_headers):
    resp = client.get("/api/v1/waivers", headers=client_auth_headers)
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# Version bump correctness
# ---------------------------------------------------------------------------


def test_update_body_bumps_version(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    assert created["version"] == 1

    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"body": "New waiver text, materially different."},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 2


def test_update_body_to_same_value_does_not_bump_version(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers, body="Original text.")
    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"body": "Original text."},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 1


def test_update_title_only_does_not_bump_version(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"title": "New Title"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 1


def test_update_requires_before_booking_only_does_not_bump_version(client, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers, requires_before_booking=False)
    resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"requires_before_booking": True},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["version"] == 1
    assert data["requires_before_booking"] is True


# ---------------------------------------------------------------------------
# Sign — happy path
# ---------------------------------------------------------------------------


def test_sign_waiver_success(client, client_auth_headers, manager_auth_headers, db_session):
    from app.models.waiver_signature import WaiverSignature

    created = _create_waiver(client, manager_auth_headers)
    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["waiver_id"] == created["id"]
    assert data["waiver_version"] == 1
    assert data["signed_name"] == "Jane Doe"
    assert "signed_at" in data

    sig = db_session.query(WaiverSignature).filter_by(id=data["id"]).first()
    assert sig is not None
    assert sig.waiver_version == 1
    assert sig.ip_address == "testclient"  # FastAPI TestClient's request.client.host


def test_sign_waiver_twice_creates_two_records(client, client_auth_headers, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)

    resp1 = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    resp2 = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert resp1.status_code == 201, resp1.text
    assert resp2.status_code == 201, resp2.text
    # Not deduped — two distinct signature records.
    assert resp1.json()["id"] != resp2.json()["id"]


def test_sign_waiver_uses_current_version_at_signing_time(
    client, client_auth_headers, manager_auth_headers
):
    created = _create_waiver(client, manager_auth_headers, body="v1 text")
    client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"body": "v2 text"},
        headers=manager_auth_headers,
    )

    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["waiver_version"] == 2


# ---------------------------------------------------------------------------
# Sign — error paths
# ---------------------------------------------------------------------------


def test_sign_waiver_not_found(client, client_auth_headers):
    resp = client.post(
        "/api/v1/waivers/99999/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAIVER_NOT_FOUND"


def test_sign_inactive_waiver_not_found(client, client_auth_headers, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    client.delete(f"/api/v1/waivers/{created['id']}", headers=manager_auth_headers)

    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "WAIVER_NOT_FOUND"


def test_sign_waiver_manager_forbidden(client, manager_auth_headers):
    """A manager must NOT be able to sign on a client's behalf — client-only endpoint."""
    created = _create_waiver(client, manager_auth_headers)
    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Manager Signing Improperly"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 403, resp.text


def test_sign_waiver_name_too_short(client, client_auth_headers, manager_auth_headers):
    created = _create_waiver(client, manager_auth_headers)
    resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "A"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# GET /clients/{client_id}/waivers — status correctness
# ---------------------------------------------------------------------------


def test_client_waivers_unsigned_by_default(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    _create_waiver(client, manager_auth_headers, title="Unsigned Waiver")
    client_id = _get_client_id(db_session, registered_client["email"])

    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert data[0]["is_signed"] is False
    assert data[0]["signed_at"] is None


def test_client_waivers_signed_reports_true(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    created = _create_waiver(client, manager_auth_headers)
    client_id = _get_client_id(db_session, registered_client["email"])

    client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )

    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert data[0]["is_signed"] is True
    assert data[0]["signed_at"] is not None


def test_client_waivers_only_lists_active(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    _create_waiver(client, manager_auth_headers, title="Active One")
    inactive = _create_waiver(client, manager_auth_headers, title="Inactive One")
    client.delete(f"/api/v1/waivers/{inactive['id']}", headers=manager_auth_headers)

    client_id = _get_client_id(db_session, registered_client["email"])
    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    titles = {w["title"] for w in resp.json()}
    assert titles == {"Active One"}


def test_client_waivers_old_version_signature_shows_unsigned_after_edit(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    """The trickiest correctness point: a client signs v1, the manager edits
    the waiver's body (bumping it to v2), and the client's status must now
    report is_signed=False — the earlier signature is still a permanent
    record of what was agreed to, but does not count as consent for the new
    version.
    """
    created = _create_waiver(client, manager_auth_headers, body="v1 text")
    client_id = _get_client_id(db_session, registered_client["email"])

    # Sign at v1.
    sign_resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert sign_resp.status_code == 201, sign_resp.text
    assert sign_resp.json()["waiver_version"] == 1

    # Confirm signed at v1 before the edit.
    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=client_auth_headers)
    assert resp.json()[0]["is_signed"] is True

    # Manager edits the body -> version bumps to 2.
    update_resp = client.put(
        f"/api/v1/waivers/{created['id']}",
        json={"body": "v2 text, materially changed"},
        headers=manager_auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["version"] == 2

    # Now the client's old v1 signature must NOT count as signed for v2.
    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=client_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert data[0]["version"] == 2
    assert data[0]["is_signed"] is False
    # signed_at still reflects their most recent signature (the old v1 one),
    # even though it no longer counts as "signed" for compliance purposes.
    assert data[0]["signed_at"] is not None


def test_client_waivers_not_found(client, manager_auth_headers):
    # A manager caller (not a client caller) reaches the 404 branch — a
    # client caller targeting a non-own id would instead get 403 from the
    # self-or-staff check, which runs first (see test_authorization.py).
    resp = client.get("/api/v1/clients/99999/waivers", headers=manager_auth_headers)
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_manager_can_view_any_client_waivers(
    client, manager_auth_headers, registered_client, db_session
):
    client_id = _get_client_id(db_session, registered_client["email"])
    resp = client.get(f"/api/v1/clients/{client_id}/waivers", headers=manager_auth_headers)
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------------
# Booking enforcement (Phase 4)
# ---------------------------------------------------------------------------


def test_booking_blocked_by_unsigned_required_waiver(
    client, client_auth_headers, manager_auth_headers, client_membership, scheduled_class_fixture
):
    created = _create_waiver(client, manager_auth_headers, requires_before_booking=True)

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()["detail"]["error"]
    assert body["code"] == "WAIVER_SIGNATURE_REQUIRED"
    assert created["id"] in body["details"]["waiver_ids"]


def test_booking_succeeds_after_signing_required_waiver(
    client, client_auth_headers, manager_auth_headers, client_membership, scheduled_class_fixture
):
    created = _create_waiver(client, manager_auth_headers, requires_before_booking=True)

    blocked = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert blocked.status_code == 409

    sign_resp = client.post(
        f"/api/v1/waivers/{created['id']}/sign",
        json={"signed_name": "Jane Doe"},
        headers=client_auth_headers,
    )
    assert sign_resp.status_code == 201, sign_resp.text

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "confirmed"


def test_booking_not_blocked_by_non_required_waiver(
    client, client_auth_headers, manager_auth_headers, client_membership, scheduled_class_fixture
):
    _create_waiver(client, manager_auth_headers, requires_before_booking=False)

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id},
        headers=client_auth_headers,
    )
    assert resp.status_code == 201, resp.text


def test_manager_booking_on_behalf_of_client_also_blocked(
    client,
    manager_auth_headers,
    registered_client,
    client_membership,
    scheduled_class_fixture,
    db_session,
):
    """The compliance requirement is about the target client's consent
    status, not who clicked the button — a manager booking for a client with
    an unsigned required waiver must ALSO be blocked.
    """
    created = _create_waiver(client, manager_auth_headers, requires_before_booking=True)
    client_id = _get_client_id(db_session, registered_client["email"])

    resp = client.post(
        "/api/v1/bookings",
        json={"scheduled_class_id": scheduled_class_fixture.id, "client_id": client_id},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()["detail"]["error"]
    assert body["code"] == "WAIVER_SIGNATURE_REQUIRED"
    assert created["id"] in body["details"]["waiver_ids"]
