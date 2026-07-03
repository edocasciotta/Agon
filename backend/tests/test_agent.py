"""
AI action agent — natural-language class creation.
Tests: happy path, ambiguous/missing entity clarification, authorization,
non-tool-call fallback, LLM failure fallback.
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest

ACT_URL = "/api/v1/agent/act"


# ─── Fixtures ────────────────────────────────────────────────────────────────


def _make_tool_call_response(name: str, arguments: dict):
    """Build a mock litellm completion response with a single tool call."""
    import json

    mock_call = MagicMock()
    mock_call.function.name = name
    mock_call.function.arguments = json.dumps(arguments)

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.tool_calls = [mock_call]
    return mock_response


def _make_plain_response(text: str):
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.tool_calls = None
    mock_response.choices[0].message.content = text
    return mock_response


def _make_class_type(db_session, name="Yoga Flow"):
    from app.models.class_template import ClassTemplate

    tmpl = ClassTemplate(
        name=name, duration_minutes=60, default_capacity=20, color="#000000", is_active=True
    )
    db_session.add(tmpl)
    db_session.commit()
    db_session.refresh(tmpl)
    return tmpl


def _make_location(db_session, name="Milano"):
    from app.models.location import Location

    loc = Location(name=name, is_active=True)
    db_session.add(loc)
    db_session.commit()
    db_session.refresh(loc)
    return loc


def _make_instructor(db_session, full_name="Elena Marino", email="elena@example.com"):
    from app.auth import hash_password
    from app.models.instructor import Instructor
    from app.models.user import User

    user = User(
        email=email,
        password_hash=hash_password("password123"),
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
    return instructor


def _next_wednesday_iso(today: datetime.date) -> str:
    days_ahead = (2 - today.weekday()) % 7  # Wednesday = 2
    if days_ahead == 0:
        days_ahead = 7
    return (today + datetime.timedelta(days=days_ahead)).isoformat()


# ─── Happy path ──────────────────────────────────────────────────────────────


def test_create_class_happy_path(client, manager_auth_headers, db_session):
    """All slots resolvable → class is actually created and returned in `action`."""
    template = _make_class_type(db_session)
    location = _make_location(db_session)
    instructor = _make_instructor(db_session)
    today = datetime.datetime.utcnow().date()

    tool_args = {
        "class_type": "Yoga Flow",
        "location": "Milano",
        "instructor": "Elena Marino",
        "date": _next_wednesday_iso(today),
        "start_time": "18:00",
        "duration_minutes": 60,
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", tool_args),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe mercoledì prossimo"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is not None
    assert data["action"]["type"] == "created_class"
    created = data["action"]["scheduled_class"]
    assert created["template_id"] == template.id
    assert created["location_id"] == location.id
    assert created["instructor_id"] == instructor.id

    from app.models.scheduled_class import ScheduledClass

    assert db_session.query(ScheduledClass).count() == 1


def test_create_class_defaults_capacity_and_duration_from_template(
    client, manager_auth_headers, db_session
):
    """Omitted capacity/duration fall back to the template's defaults."""
    template = _make_class_type(db_session)
    _make_location(db_session)
    today = datetime.datetime.utcnow().date()

    tool_args = {
        "class_type": "Yoga Flow",
        "location": "Milano",
        "date": _next_wednesday_iso(today),
        "start_time": "09:00",
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", tool_args),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    created = response.json()["action"]["scheduled_class"]
    assert created["capacity"] == template.default_capacity
    assert created["instructor_id"] is None


# ─── Clarification paths — nothing gets created ─────────────────────────────


def test_ambiguous_instructor_asks_for_clarification(client, manager_auth_headers, db_session):
    """Two instructors match the given name substring → no class created."""
    _make_class_type(db_session)
    _make_location(db_session)
    _make_instructor(db_session, full_name="Elena Marino", email="elena@example.com")
    _make_instructor(db_session, full_name="Elena Rossi", email="elena2@example.com")
    today = datetime.datetime.utcnow().date()

    tool_args = {
        "class_type": "Yoga Flow",
        "location": "Milano",
        "instructor": "Elena",
        "date": _next_wednesday_iso(today),
        "start_time": "18:00",
        "duration_minutes": 60,
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", tool_args),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe con Elena"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] is None
    assert "Elena Marino" in data["reply"] and "Elena Rossi" in data["reply"]

    from app.models.scheduled_class import ScheduledClass

    assert db_session.query(ScheduledClass).count() == 0


def test_unknown_location_asks_for_clarification(client, manager_auth_headers, db_session):
    """A location name that matches nothing → no class created, clarifying reply."""
    _make_class_type(db_session)
    _make_location(db_session, name="Milano")
    today = datetime.datetime.utcnow().date()

    tool_args = {
        "class_type": "Yoga Flow",
        "location": "Napoli",
        "date": _next_wednesday_iso(today),
        "start_time": "18:00",
        "duration_minutes": 60,
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", tool_args),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe a Napoli"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] is None

    from app.models.scheduled_class import ScheduledClass

    assert db_session.query(ScheduledClass).count() == 0


def test_missing_date_asks_for_clarification(client, manager_auth_headers, db_session):
    """No date extracted at all → clarifying question, not a guess."""
    _make_class_type(db_session)
    _make_location(db_session)

    tool_args = {
        "class_type": "Yoga Flow",
        "location": "Milano",
        "start_time": "18:00",
        "duration_minutes": 60,
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", tool_args),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe di yoga"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] is None

    from app.models.scheduled_class import ScheduledClass

    assert db_session.query(ScheduledClass).count() == 0


# ─── No tool call / LLM failure ──────────────────────────────────────────────


def test_non_action_message_returns_plain_reply(client, manager_auth_headers):
    """If the model doesn't call the tool, the endpoint returns plain text with no action."""
    with patch(
        "app.routers.agent.completion",
        return_value=_make_plain_response("Non ho capito, puoi riformulare?"),
    ):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "ciao"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["action"] is None
    assert data["reply"]


def test_llm_failure_returns_graceful_fallback(client, manager_auth_headers):
    """LLM exception → 200 with a fallback reply, never a raw error to the user."""
    with patch("app.routers.agent.completion", side_effect=Exception("provider down")):
        response = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "crea una classe"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    assert response.json()["action"] is None


# ─── Authorization ───────────────────────────────────────────────────────────


def test_client_role_forbidden(client, client_auth_headers):
    response = client.post(
        ACT_URL,
        json={"messages": [{"role": "user", "content": "crea una classe"}]},
        headers=client_auth_headers,
    )
    assert response.status_code == 403


def test_instructor_role_forbidden(client, db_session):
    from app.auth import create_access_token, hash_password
    from app.models.user import User

    instructor_user = User(
        email="staff@example.com",
        password_hash=hash_password("password123"),
        full_name="Staff Instructor",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor_user)
    db_session.commit()
    db_session.refresh(instructor_user)
    token = create_access_token({"sub": str(instructor_user.id), "role": "instructor"})

    response = client.post(
        ACT_URL,
        json={"messages": [{"role": "user", "content": "crea una classe"}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_unauthenticated_forbidden(client):
    response = client.post(
        ACT_URL, json={"messages": [{"role": "user", "content": "crea una classe"}]}
    )
    assert response.status_code == 401


# ─── resolve_date: relative day terms (regression) ──────────────────────────


def test_resolve_date_understands_relative_italian_and_english_terms():
    from app.services.agent_tools import resolve_date

    today = datetime.date(2026, 7, 2)  # Thursday
    assert resolve_date("oggi", today) == today
    assert resolve_date("domani", today) == today + datetime.timedelta(days=1)
    assert resolve_date("dopodomani", today) == today + datetime.timedelta(days=2)
    assert resolve_date("today", today) == today
    assert resolve_date("tomorrow", today) == today + datetime.timedelta(days=1)
    assert resolve_date("mercoledì prossimo", today) == today + datetime.timedelta(days=6)


# ─── Multi-turn slot accumulation (regression for reported bug) ────────────
#
# A manager reported that spreading a request across several messages
# ("agon genova" -> "domani" -> "8.45 AM") ended up creating the class on the
# wrong day, because each turn re-derived every field from scratch with no
# memory of what was already resolved. These tests drive the same multi-turn
# shape and assert the final class matches every answer actually given.


def test_multi_turn_conversation_accumulates_slots_correctly(
    client, manager_auth_headers, db_session
):
    _make_class_type(db_session)
    _make_location(db_session, name="Agon Genova")
    today = datetime.datetime.utcnow().date()
    tomorrow_iso = (today + datetime.timedelta(days=1)).isoformat()

    # Turn 1: "create a class" -> only location extracted this turn
    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", {"location": "Genova"}),
    ):
        resp1 = client.post(
            ACT_URL,
            json={"messages": [{"role": "user", "content": "create a class"}], "draft": None},
            headers=manager_auth_headers,
        )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["action"] is None
    assert data1["draft"]["location"] == "Genova"

    # Turn 2: "domani" -> only date extracted this turn; location must survive from the draft
    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", {"date": "domani"}),
    ):
        resp2 = client.post(
            ACT_URL,
            json={
                "messages": [
                    {"role": "user", "content": "create a class"},
                    {"role": "assistant", "content": data1["reply"]},
                    {"role": "user", "content": "domani"},
                ],
                "draft": data1["draft"],
            },
            headers=manager_auth_headers,
        )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["action"] is None
    assert data2["draft"]["location"] == "Genova"
    # The draft carries the raw slot forward (resolved fresh each time by
    # handle_create_class) — the point of this test is that it survives to
    # the next turn unresolved, not that it's pre-resolved here.
    assert data2["draft"]["date"] == "domani"

    # Turn 3: "8.45 AM" -> only time extracted; everything else must still be resolved
    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("create_class", {"start_time": "08:45"}),
    ):
        resp3 = client.post(
            ACT_URL,
            json={
                "messages": [
                    {"role": "user", "content": "create a class"},
                    {"role": "assistant", "content": data1["reply"]},
                    {"role": "user", "content": "domani"},
                    {"role": "assistant", "content": data2["reply"]},
                    {"role": "user", "content": "8.45 AM"},
                ],
                "draft": data2["draft"],
            },
            headers=manager_auth_headers,
        )
    assert resp3.status_code == 200, resp3.text
    data3 = resp3.json()
    assert data3["action"] is not None
    created = data3["action"]["scheduled_class"]
    assert created["starts_at"].startswith(tomorrow_iso)
    assert created["starts_at"].endswith("08:45:00")


def test_later_correction_overrides_earlier_draft_value(client, manager_auth_headers, db_session):
    """If the user corrects an already-resolved field in a later turn, the new value wins."""
    _make_class_type(db_session)
    _make_location(db_session)
    today = datetime.datetime.utcnow().date()
    wrong_date_iso = (today + datetime.timedelta(days=1)).isoformat()
    next_wednesday_iso = _next_wednesday_iso(today)

    draft_with_wrong_date = {
        "location": "Milano",
        "date": wrong_date_iso,
        "duration_minutes": 60,
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response(
            "create_class", {"date": "mercoledì prossimo", "start_time": "18:00"}
        ),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [{"role": "user", "content": "mercoledì prossimo alle 18"}],
                "draft": draft_with_wrong_date,
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is not None
    created = data["action"]["scheduled_class"]
    assert created["starts_at"].startswith(next_wednesday_iso)


# ─── Timezone anchor (regression) ────────────────────────────────────────────
#
# A manager in Europe/Rome reported "domani" resolving to the wrong day. Root
# cause: relative dates were anchored to raw UTC "today", which can already be
# a different calendar day than the studio's local time (e.g. 23:30 UTC on
# July 1st is 01:30 CEST on July 2nd in Rome). This test fixes the clock at
# exactly that boundary and asserts "domani" resolves against Rome's calendar
# day, not UTC's.


def test_relative_date_anchored_to_studio_timezone_not_utc(
    client, manager_auth_headers, db_session
):
    from app.models.studio_settings import StudioSettings

    db_session.add(StudioSettings(id=1, studio_name="Test Studio", timezone="Europe/Rome"))
    db_session.commit()

    _make_class_type(db_session)
    _make_location(db_session, name="Agon Genova")

    # 23:30 UTC on July 1st == 01:30 CEST on July 2nd in Rome.
    fixed_utc = datetime.datetime(2026, 7, 1, 23, 30, tzinfo=datetime.timezone.utc)
    # utcnow() in agent_tools returns a naive UTC datetime — freeze it to the
    # same instant so the "is class in the past?" guard sees consistent time.
    fixed_utcnow = datetime.datetime(2026, 7, 1, 23, 30)

    class FrozenDateTime(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_utc.astimezone(tz) if tz else fixed_utc

    with patch("app.routers.agent.datetime", FrozenDateTime):
        with patch("app.services.agent_tools.utcnow", return_value=fixed_utcnow):
            with patch(
                "app.routers.agent.completion",
                return_value=_make_tool_call_response(
                    "create_class",
                    {"location": "Genova", "date": "domani", "start_time": "08:45"},
                ),
            ):
                response = client.post(
                    ACT_URL,
                    json={
                        "messages": [
                            {
                                "role": "user",
                                "content": "crea una classe domani a Genova alle 8:45",
                            }
                        ]
                    },
                    headers=manager_auth_headers,
                )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is not None
    created = data["action"]["scheduled_class"]
    # Rome-local "today" at this instant is already July 2nd, so "domani" must
    # be July 3rd — not July 2nd (raw UTC's "tomorrow").
    assert created["starts_at"].startswith("2026-07-03")


# ─── cancel_booking confirmation gate ────────────────────────────────────────


def test_cancel_booking_without_confirmation_intercepts(client, manager_auth_headers):
    """Model returns cancel_booking tool call but user has NOT confirmed.
    Router must intercept and return a confirmation prompt — no DB write."""
    cancel_args = {
        "client": "Maria Rossi",
        "class_type": "Yoga Flow",
        "date": "2026-07-04",
        "start_time": "10:00",
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("cancel_booking", cancel_args),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [
                    {"role": "user", "content": "cancella la prenotazione di Maria Rossi"}
                ],
                "language": "it",
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    # Must return a confirmation prompt, not execute
    assert data["action"] is None
    reply = data["reply"].lower()
    assert "maria rossi" in reply
    assert "yoga flow" in reply
    # Italian prompt ends with "vuoi procedere?"
    assert "procedere" in reply or "proceed" in reply


def test_cancel_booking_with_confirmation_calls_handler(client, manager_auth_headers):
    """Model returns cancel_booking tool call and last user message contains 'sì'.
    Router must call the handler (which returns not-found here — no real booking)."""
    cancel_args = {
        "client": "Maria Rossi",
        "class_type": "Yoga Flow",
        "date": "2026-07-04",
        "start_time": "10:00",
    }

    with patch(
        "app.routers.agent.completion",
        return_value=_make_tool_call_response("cancel_booking", cancel_args),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [
                    {"role": "user", "content": "cancella la prenotazione di Maria Rossi"},
                    {
                        "role": "assistant",
                        "content": "Sto per cancellare. Vuoi procedere?",
                    },
                    {"role": "user", "content": "Sì, procedi"},
                ],
                "language": "it",
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    # Handler was called (not intercepted). No booking exists → not-found reply.
    # The key assertion: no confirmation prompt returned (reply doesn't ask "procedere").
    assert "procedere" not in data["reply"].lower()


# ─── Hallucinated tool call guard ─────────────────────────────────────────────


def test_is_hallucinated_tool_call_detects_unknown_tool():
    from app.routers.agent import _is_hallucinated_tool_call

    assert _is_hallucinated_tool_call('{"name": "create_location", "parameters": {}}') is True
    assert _is_hallucinated_tool_call('{"name": "Agon Bologna", "address": "Via X 1"}') is True
    assert _is_hallucinated_tool_call('{"name": "delete_studio"}') is True


def test_is_hallucinated_tool_call_passes_known_tools():
    from app.routers.agent import _is_hallucinated_tool_call

    assert _is_hallucinated_tool_call('{"name": "create_class", "parameters": {}}') is False
    assert _is_hallucinated_tool_call('{"name": "get_report", "parameters": {}}') is False
    assert _is_hallucinated_tool_call("Not JSON at all") is False
    assert _is_hallucinated_tool_call("{'invalid json'}") is False


def test_hallucinated_tool_call_returns_unsupported_reply(client, manager_auth_headers):
    """When the model outputs JSON for an unknown tool, the router must NOT return
    raw JSON to the user — it should return a localized 'unsupported operation' reply."""
    with patch(
        "app.routers.agent.completion",
        return_value=_make_plain_response('{"name": "create_location", "parameters": {}}'),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [{"role": "user", "content": "create a new establishment"}],
                "language": "en",
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is None
    # Must not contain raw JSON
    assert "{" not in data["reply"]
    # Must mention what the agent can do
    assert "class" in data["reply"].lower() or "report" in data["reply"].lower()


# ─── Echoed studio data guard ─────────────────────────────────────────────────


def test_is_echoed_studio_data_detects_membership_types():
    from app.routers.agent import _is_echoed_studio_data

    # membership_types JSON echoed verbatim from studio data
    payload = '{"membership_types": [{"name": "Pack", "type": "credit_pack"}]}'
    assert _is_echoed_studio_data(payload) is True


def test_is_echoed_studio_data_detects_other_studio_keys():
    from app.routers.agent import _is_echoed_studio_data

    assert _is_echoed_studio_data('{"class_types": [{"name": "Yoga"}]}') is True
    assert _is_echoed_studio_data('{"locations": []}') is True
    assert _is_echoed_studio_data('{"clients": [], "total": 0}') is True


def test_is_echoed_studio_data_passes_valid_tool_call():
    from app.routers.agent import _is_echoed_studio_data

    # Has "name" key → it's a tool call, not studio data
    assert _is_echoed_studio_data('{"name": "assign_membership", "parameters": {}}') is False
    assert _is_echoed_studio_data('{"name": "create_class", "parameters": {}}') is False
    assert _is_echoed_studio_data("Just plain text") is False
    assert _is_echoed_studio_data("{'invalid json'}") is False


def test_echoed_studio_data_returns_fallback_not_raw_json(client, manager_auth_headers):
    """When model echoes membership_types JSON, the router must NOT return raw JSON."""
    membership_json = '{"membership_types": [{"name": "Pack", "price": 50.0}]}'
    with patch(
        "app.routers.agent.completion",
        return_value=_make_plain_response(membership_json),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [
                    {"role": "user", "content": "assign Elena a new membership plan"},
                    {"role": "assistant", "content": "Elena has no active membership."},
                    {"role": "user", "content": "assign to Elena Verdi the Membership Pack"},
                ],
                "language": "en",
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is None
    # Must NOT return raw JSON to the user
    assert "membership_types" not in data["reply"]
    assert data["reply"]  # Must return something (fallback)


@pytest.mark.parametrize(
    "raw_json",
    [
        # Double-encoded parameters string with truncated inner JSON
        '{"name": "create_class", "parameters": "{\\"class_type\\": \\"Yoga\\", \\"date\\": \\"2026-07-04\\""}',
        # Valid outer JSON but inner parameters string is malformed (extra brace)
        '{"name": "create_class", "parameters": "{\\"class_type\\": \\"Yoga\\", \\"duration_minutes\\": 60}}"}',
        # Parameters is empty string (unparseable)
        '{"name": "assign_membership", "parameters": ""}',
    ],
)
def test_malformed_tool_call_returns_fallback_not_raw_json(raw_json, client, manager_auth_headers):
    """When the model emits a known tool name but unparseable parameters, the
    router must return a fallback message — never the raw JSON string."""
    with patch(
        "app.routers.agent.completion",
        return_value=_make_plain_response(raw_json),
    ):
        response = client.post(
            ACT_URL,
            json={
                "messages": [{"role": "user", "content": "create a Yoga class tomorrow at 22:12"}],
                "language": "en",
            },
            headers=manager_auth_headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["action"] is None
    # Must NOT echo raw JSON back to user
    assert not data["reply"].startswith("{"), f"Got raw JSON: {data['reply']}"
    assert data["reply"]  # fallback message must be non-empty
