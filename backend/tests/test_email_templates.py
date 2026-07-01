"""
Tests for:
- Email Templates CRUD  (GET/POST/PUT/DELETE /api/v1/email/templates)
- Email Event Assignments  (GET/PUT /api/v1/email/events)
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_template(
    client, manager_auth_headers, name="Welcome EN", subject="Hi {{client_name}}!"
):
    resp = client.post(
        "/api/v1/email/templates",
        json={"name": name, "subject": subject, "html_body": "<p>Hello {{client_name}}</p>"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Email Templates
# ---------------------------------------------------------------------------


def test_list_templates_empty(client, manager_auth_headers):
    resp = client.get("/api/v1/email/templates", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_template(client, manager_auth_headers):
    resp = client.post(
        "/api/v1/email/templates",
        json={
            "name": "Booking Confirmed IT",
            "subject": "Prenotazione confermata, {{client_name}}!",
            "html_body": "<h1>Ciao {{client_name}}</h1>",
        },
        headers=manager_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Booking Confirmed IT"
    assert data["subject"] == "Prenotazione confermata, {{client_name}}!"
    assert data["html_body"] == "<h1>Ciao {{client_name}}</h1>"
    assert "id" in data
    assert "created_at" in data


def test_get_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.get(f"/api/v1/email/templates/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]
    assert resp.json()["html_body"] == created["html_body"]


def test_get_template_not_found(client, manager_auth_headers):
    resp = client.get("/api/v1/email/templates/9999", headers=manager_auth_headers)
    assert resp.status_code == 404


def test_update_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.put(
        f"/api/v1/email/templates/{created['id']}",
        json={"name": "Updated Name", "subject": "New Subject"},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["subject"] == "New Subject"
    # html_body should be unchanged
    assert data["html_body"] == created["html_body"]


def test_delete_template(client, manager_auth_headers):
    created = _create_template(client, manager_auth_headers)
    resp = client.delete(f"/api/v1/email/templates/{created['id']}", headers=manager_auth_headers)
    assert resp.status_code == 200
    # Confirm it's gone
    resp2 = client.get(f"/api/v1/email/templates/{created['id']}", headers=manager_auth_headers)
    assert resp2.status_code == 404


def test_delete_template_assigned_returns_409(client, manager_auth_headers):
    """Deleting a template that is currently assigned to an event returns 409."""
    created = _create_template(client, manager_auth_headers)

    # Assign it to an event
    assign_resp = client.put(
        "/api/v1/email/events/client_invite",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )
    assert assign_resp.status_code == 200

    # Now try to delete
    del_resp = client.delete(
        f"/api/v1/email/templates/{created['id']}", headers=manager_auth_headers
    )
    assert del_resp.status_code == 409
    assert del_resp.json()["detail"]["error"]["code"] == "TEMPLATE_IN_USE"


# ---------------------------------------------------------------------------
# Email Event Assignments
# ---------------------------------------------------------------------------


def test_get_event_assignments_all_types(client, manager_auth_headers):
    """All 7 event types should appear in the list."""
    resp = client.get("/api/v1/email/events", headers=manager_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    event_types = [item["event_type"] for item in data]
    expected = [
        "client_invite",
        "password_reset",
        "booking_confirmed",
        "booking_cancelled",
        "class_reminder",
        "membership_expiring",
        "waitlist_promoted",
    ]
    for et in expected:
        assert et in event_types
    assert len(data) == 7


def test_get_event_assignments_unassigned_by_default(client, manager_auth_headers):
    resp = client.get("/api/v1/email/events", headers=manager_auth_headers)
    assert resp.status_code == 200
    for item in resp.json():
        assert item["template"] is None


def test_assign_template_to_event(client, manager_auth_headers):
    """Assigning a template to an event returns the assignment with template info."""
    created = _create_template(client, manager_auth_headers)

    resp = client.put(
        "/api/v1/email/events/booking_confirmed",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_type"] == "booking_confirmed"
    assert data["template"]["id"] == created["id"]
    assert data["template"]["name"] == created["name"]

    # Verify it appears in the list too
    list_resp = client.get("/api/v1/email/events", headers=manager_auth_headers)
    booking_event = next(
        item for item in list_resp.json() if item["event_type"] == "booking_confirmed"
    )
    assert booking_event["template"]["id"] == created["id"]


def test_unassign_template(client, manager_auth_headers):
    """Assigning template_id=null unassigns the template."""
    created = _create_template(client, manager_auth_headers)

    # Assign
    client.put(
        "/api/v1/email/events/class_reminder",
        json={"template_id": created["id"]},
        headers=manager_auth_headers,
    )

    # Unassign
    resp = client.put(
        "/api/v1/email/events/class_reminder",
        json={"template_id": None},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["template"] is None


def test_assign_invalid_event_type(client, manager_auth_headers):
    resp = client.put(
        "/api/v1/email/events/nonexistent_event",
        json={"template_id": None},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404


def test_assign_nonexistent_template(client, manager_auth_headers):
    resp = client.put(
        "/api/v1/email/events/client_invite",
        json={"template_id": 9999},
        headers=manager_auth_headers,
    )
    assert resp.status_code == 404
