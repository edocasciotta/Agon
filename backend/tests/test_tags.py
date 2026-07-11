"""Tests for the Tags system — CRUD, client tag assignment, auto-tag rules."""

import json

import pytest
from app.models.auto_tag_rule import AutoTagRule
from app.models.client import Client
from app.models.client_tag import ClientTag
from app.models.tag import Tag
from app.utils import utcnow


# ── Tag CRUD ─────────────────────────────────────────────────────────────────


class TestTagCRUD:
    def test_create_tag(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "VIP", "color": "#FF5733"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "VIP"
        assert data["color"] == "#FF5733"
        assert "id" in data
        assert "created_at" in data

    def test_create_tag_without_color(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "NewClient"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["color"] is None

    def test_create_duplicate_tag(self, client, manager_auth_headers):
        client.post(
            "/api/v1/tags",
            json={"name": "VIP"},
            headers=manager_auth_headers,
        )
        resp = client.post(
            "/api/v1/tags",
            json={"name": "VIP"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"]["code"] == "TAG_DUPLICATE"

    def test_list_tags(self, client, manager_auth_headers):
        client.post("/api/v1/tags", json={"name": "A-Tag"}, headers=manager_auth_headers)
        client.post("/api/v1/tags", json={"name": "B-Tag"}, headers=manager_auth_headers)
        resp = client.get("/api/v1/tags", headers=manager_auth_headers)
        assert resp.status_code == 200
        names = [t["name"] for t in resp.json()]
        assert "A-Tag" in names
        assert "B-Tag" in names

    def test_update_tag(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Old", "color": "#000000"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        resp = client.put(
            f"/api/v1/tags/{tag_id}",
            json={"name": "New", "color": "#FFFFFF"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"
        assert resp.json()["color"] == "#FFFFFF"

    def test_update_tag_not_found(self, client, manager_auth_headers):
        resp = client.put(
            "/api/v1/tags/9999",
            json={"name": "Ghost"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 404

    def test_update_tag_duplicate_name(self, client, manager_auth_headers):
        client.post("/api/v1/tags", json={"name": "TagA"}, headers=manager_auth_headers)
        resp = client.post("/api/v1/tags", json={"name": "TagB"}, headers=manager_auth_headers)
        tag_b_id = resp.json()["id"]
        resp = client.put(
            f"/api/v1/tags/{tag_b_id}",
            json={"name": "TagA"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 409

    def test_delete_tag(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Deleteable"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        resp = client.delete(f"/api/v1/tags/{tag_id}", headers=manager_auth_headers)
        assert resp.status_code == 200

        # Verify deleted
        resp = client.get("/api/v1/tags", headers=manager_auth_headers)
        names = [t["name"] for t in resp.json()]
        assert "Deleteable" not in names

    def test_delete_tag_not_found(self, client, manager_auth_headers):
        resp = client.delete("/api/v1/tags/9999", headers=manager_auth_headers)
        assert resp.status_code == 404

    def test_delete_tag_cascades_to_client_tags(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        """Deleting a tag must also remove all ClientTag entries referencing it."""
        # Create tag
        resp = client.post(
            "/api/v1/tags",
            json={"name": "CascadeTest"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        # Assign tag to client
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201

        # Verify client_tag exists
        ct_count = db_session.query(ClientTag).filter_by(tag_id=tag_id).count()
        assert ct_count == 1

        # Delete the tag
        resp = client.delete(f"/api/v1/tags/{tag_id}", headers=manager_auth_headers)
        assert resp.status_code == 200

        # Verify client_tag was cascaded
        db_session.expire_all()
        ct_count = db_session.query(ClientTag).filter_by(tag_id=tag_id).count()
        assert ct_count == 0


# ── Client Tag Assignment ────────────────────────────────────────────────────


class TestClientTags:
    def test_assign_tag_to_client(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        # Create tag
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Active", "color": "#00FF00"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["tag_name"] == "Active"
        assert data["tag_color"] == "#00FF00"
        assert data["assigned_by"] == "manual"

    def test_duplicate_tag_assignment_silent(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        """Assigning the same tag twice must succeed silently (no error)."""
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Dup"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()

        # First assignment
        resp = client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201

        # Second assignment — same tag
        resp = client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201  # no error

    def test_list_client_tags(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        # Create and assign tags
        for name in ["TagX", "TagY"]:
            resp = client.post(
                "/api/v1/tags",
                json={"name": name},
                headers=manager_auth_headers,
            )
            tag_id = resp.json()["id"]
            client_obj = (
                db_session.query(Client).filter_by(email=registered_client["email"]).first()
            )
            client.post(
                f"/api/v1/clients/{client_obj.id}/tags",
                json={"tag_id": tag_id},
                headers=manager_auth_headers,
            )

        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "TagX" in tag_names
        assert "TagY" in tag_names

    def test_remove_tag_from_client(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Remove"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )

        resp = client.delete(
            f"/api/v1/clients/{client_obj.id}/tags/{tag_id}",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200

    def test_remove_tag_not_found(self, client, manager_auth_headers, registered_client, db_session):
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.delete(
            f"/api/v1/clients/{client_obj.id}/tags/9999",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 404

    def test_assign_nonexistent_tag(
        self, client, manager_auth_headers, registered_client, db_session
    ):
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": 9999},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 404

    def test_assign_tag_nonexistent_client(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Ghost"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        resp = client.post(
            "/api/v1/clients/9999/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 404

    def test_client_can_view_own_tags(
        self, client, manager_auth_headers, client_auth_headers, registered_client, db_session
    ):
        """Client can view their own tags."""
        resp = client.post(
            "/api/v1/tags",
            json={"name": "SelfView"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        client.post(
            f"/api/v1/clients/{client_obj.id}/tags",
            json={"tag_id": tag_id},
            headers=manager_auth_headers,
        )

        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=client_auth_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ── Auto-Tag Rules ───────────────────────────────────────────────────────────


class TestAutoTagRules:
    def test_create_auto_tag_rule(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "Booker"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        resp = client.post(
            "/api/v1/auto-tag-rules",
            json={
                "tag_id": tag_id,
                "trigger_event": "booking_created",
                "is_active": True,
            },
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["tag_id"] == tag_id
        assert data["trigger_event"] == "booking_created"
        assert data["is_active"] is True

    def test_create_auto_tag_rule_with_conditions(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "PremiumMember"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        resp = client.post(
            "/api/v1/auto-tag-rules",
            json={
                "tag_id": tag_id,
                "trigger_event": "membership_purchased",
                "condition_json": {"membership_type_id": 5},
            },
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["condition_json"] is not None
        cond = json.loads(data["condition_json"])
        assert cond["membership_type_id"] == 5

    def test_create_auto_tag_rule_invalid_event(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "BadEvent"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        resp = client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "invalid_event"},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["error"]["code"] == "INVALID_TRIGGER_EVENT"

    def test_list_auto_tag_rules(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "ListTest"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "no_show"},
            headers=manager_auth_headers,
        )

        resp = client.get("/api/v1/auto-tag-rules", headers=manager_auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_update_auto_tag_rule(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "UpTag"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        resp = client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "booking_created"},
            headers=manager_auth_headers,
        )
        rule_id = resp.json()["id"]

        resp = client.put(
            f"/api/v1/auto-tag-rules/{rule_id}",
            json={"is_active": False},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_update_auto_tag_rule_not_found(self, client, manager_auth_headers):
        resp = client.put(
            "/api/v1/auto-tag-rules/9999",
            json={"is_active": False},
            headers=manager_auth_headers,
        )
        assert resp.status_code == 404

    def test_delete_auto_tag_rule(self, client, manager_auth_headers):
        resp = client.post(
            "/api/v1/tags",
            json={"name": "DelRule"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]
        resp = client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "checkin"},
            headers=manager_auth_headers,
        )
        rule_id = resp.json()["id"]

        resp = client.delete(
            f"/api/v1/auto-tag-rules/{rule_id}",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200

    def test_delete_auto_tag_rule_not_found(self, client, manager_auth_headers):
        resp = client.delete("/api/v1/auto-tag-rules/9999", headers=manager_auth_headers)
        assert resp.status_code == 404


# ── Auto-Tag Firing (integration) ───────────────────────────────────────────


class TestAutoTagFiring:
    def test_auto_tag_fires_on_booking_created(
        self,
        client,
        manager_auth_headers,
        client_auth_headers,
        registered_client,
        client_membership,
        scheduled_class_fixture,
        db_session,
    ):
        """When a booking is created, an auto-tag rule for booking_created should fire."""
        # Create tag + rule
        resp = client.post(
            "/api/v1/tags",
            json={"name": "HasBooked"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "booking_created"},
            headers=manager_auth_headers,
        )

        # Create booking as client
        resp = client.post(
            "/api/v1/bookings",
            json={"scheduled_class_id": scheduled_class_fixture.id},
            headers=client_auth_headers,
        )
        assert resp.status_code == 201

        # Verify tag was auto-assigned
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "HasBooked" in tag_names
        # assigned_by should be "auto"
        auto_tags = [t for t in resp.json() if t["tag_name"] == "HasBooked"]
        assert auto_tags[0]["assigned_by"] == "auto"

    def test_auto_tag_fires_on_membership_purchased(
        self,
        client,
        manager_auth_headers,
        registered_client,
        membership_type,
        db_session,
    ):
        """When a membership is purchased, an auto-tag rule for membership_purchased fires."""
        import datetime

        # Create tag + rule
        resp = client.post(
            "/api/v1/tags",
            json={"name": "MembershipHolder"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client.post(
            "/api/v1/auto-tag-rules",
            json={
                "tag_id": tag_id,
                "trigger_event": "membership_purchased",
            },
            headers=manager_auth_headers,
        )

        # Assign membership via manager
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            "/api/v1/memberships",
            json={
                "client_id": client_obj.id,
                "membership_type_id": membership_type.id,
                "starts_at": datetime.date.today().isoformat(),
            },
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201

        # Verify tag was auto-assigned
        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "MembershipHolder" in tag_names

    def test_auto_tag_with_condition_matching(
        self,
        client,
        manager_auth_headers,
        registered_client,
        membership_type,
        db_session,
    ):
        """Auto-tag with condition_json matching the event data should fire."""
        import datetime

        # Create tag + rule with condition
        resp = client.post(
            "/api/v1/tags",
            json={"name": "SpecificPlan"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client.post(
            "/api/v1/auto-tag-rules",
            json={
                "tag_id": tag_id,
                "trigger_event": "membership_purchased",
                "condition_json": {"membership_type_id": membership_type.id},
            },
            headers=manager_auth_headers,
        )

        # Assign membership
        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            "/api/v1/memberships",
            json={
                "client_id": client_obj.id,
                "membership_type_id": membership_type.id,
                "starts_at": datetime.date.today().isoformat(),
            },
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201

        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=manager_auth_headers,
        )
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "SpecificPlan" in tag_names

    def test_auto_tag_with_condition_not_matching(
        self,
        client,
        manager_auth_headers,
        registered_client,
        membership_type,
        db_session,
    ):
        """Auto-tag with condition_json NOT matching event data should NOT fire."""
        import datetime

        resp = client.post(
            "/api/v1/tags",
            json={"name": "WrongPlan"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        # Condition requires membership_type_id=9999 which won't match
        client.post(
            "/api/v1/auto-tag-rules",
            json={
                "tag_id": tag_id,
                "trigger_event": "membership_purchased",
                "condition_json": {"membership_type_id": 9999},
            },
            headers=manager_auth_headers,
        )

        client_obj = db_session.query(Client).filter_by(email=registered_client["email"]).first()
        resp = client.post(
            "/api/v1/memberships",
            json={
                "client_id": client_obj.id,
                "membership_type_id": membership_type.id,
                "starts_at": datetime.date.today().isoformat(),
            },
            headers=manager_auth_headers,
        )
        assert resp.status_code == 201

        resp = client.get(
            f"/api/v1/clients/{client_obj.id}/tags",
            headers=manager_auth_headers,
        )
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "WrongPlan" not in tag_names

    def test_auto_tag_fires_on_no_show(
        self,
        client,
        manager_auth_headers,
        confirmed_booking,
        db_session,
    ):
        """When a booking is marked as no-show, auto-tag for no_show fires."""
        resp = client.post(
            "/api/v1/tags",
            json={"name": "NoShowClient"},
            headers=manager_auth_headers,
        )
        tag_id = resp.json()["id"]

        client.post(
            "/api/v1/auto-tag-rules",
            json={"tag_id": tag_id, "trigger_event": "no_show"},
            headers=manager_auth_headers,
        )

        # Mark no-show
        resp = client.post(
            f"/api/v1/bookings/{confirmed_booking.id}/no-show",
            headers=manager_auth_headers,
        )
        assert resp.status_code == 200

        resp = client.get(
            f"/api/v1/clients/{confirmed_booking.client_id}/tags",
            headers=manager_auth_headers,
        )
        tag_names = [t["tag_name"] for t in resp.json()]
        assert "NoShowClient" in tag_names
