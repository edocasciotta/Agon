"""
Phase 11.2 — AI Support Agent
Tests: success, unauthenticated, LLM error fallback, pre-screening.
"""
from unittest.mock import patch, MagicMock
import pytest

import app.routers.support as support_module


CHAT_URL = "/api/v1/support/chat"

SAMPLE_MESSAGES = [
    {"role": "user", "content": "How do I cancel a class?"}
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _make_llm_response(text: str):
    """Build a mock litellm completion response."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = text
    return mock_response


def _reset_docs_cache():
    """Reset module-level docs cache so tests control the vocabulary."""
    support_module._DOCS_CONTEXT = None
    support_module._DOCS_VOCABULARY = None


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_support_chat_success(client, manager_auth_headers):
    """Valid request with mocked LLM returns a reply."""
    expected_reply = "To cancel a class, navigate to the calendar and select the class."

    with patch("app.routers.support.completion", return_value=_make_llm_response(expected_reply)) as mock_llm:
        response = client.post(
            CHAT_URL,
            json={"messages": SAMPLE_MESSAGES},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["reply"] == expected_reply
    mock_llm.assert_called_once()


def test_support_chat_unauthenticated(client):
    """Request without a token returns 401."""
    response = client.post(
        CHAT_URL,
        json={"messages": SAMPLE_MESSAGES},
    )
    assert response.status_code == 401


def test_support_chat_llm_error(client, manager_auth_headers):
    """When the LLM raises an exception the endpoint still returns 200 with fallback message."""
    from app.routers.support import FALLBACK_REPLY

    with patch("app.routers.support.completion", side_effect=Exception("LLM unavailable")):
        response = client.post(
            CHAT_URL,
            json={"messages": SAMPLE_MESSAGES},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["reply"] == FALLBACK_REPLY


# ─── Pre-screening tests ──────────────────────────────────────────────────────

def test_prescreening_rejects_out_of_scope_without_calling_llm(client, manager_auth_headers):
    """
    A question with no Agon-related words must return OUT_OF_SCOPE_REPLY
    without ever calling the LLM.
    """
    from app.routers.support import OUT_OF_SCOPE_REPLY

    _reset_docs_cache()

    # Inject a small controlled vocabulary so the test is deterministic
    support_module._DOCS_CONTEXT = "booking membership client calendar studio"
    support_module._DOCS_VOCABULARY = {"booking", "membership", "client", "calendar", "studio"}

    with patch("app.routers.support.completion") as mock_llm:
        response = client.post(
            CHAT_URL,
            json={"messages": [{"role": "user", "content": "come si fa la carbonara?"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == OUT_OF_SCOPE_REPLY
    mock_llm.assert_not_called()

    _reset_docs_cache()


def test_prescreening_allows_agon_question(client, manager_auth_headers):
    """
    A question containing Agon vocabulary (e.g. 'booking') must pass the
    pre-screening and reach the LLM.
    """
    expected_reply = "Go to Calendar, then click the class to manage bookings."

    _reset_docs_cache()
    support_module._DOCS_CONTEXT = "booking membership client calendar studio"
    support_module._DOCS_VOCABULARY = {"booking", "membership", "client", "calendar", "studio"}

    with patch("app.routers.support.completion", return_value=_make_llm_response(expected_reply)) as mock_llm:
        response = client.post(
            CHAT_URL,
            json={"messages": [{"role": "user", "content": "How do I manage bookings for a class?"}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    assert response.json()["reply"] == expected_reply
    mock_llm.assert_called_once()

    _reset_docs_cache()


def test_is_in_scope_function_directly():
    """Unit test the _is_in_scope helper directly."""
    from app.routers.support import _is_in_scope

    vocab = {"booking", "membership", "client", "calendar", "studio", "class", "schedule"}

    # Should pass — contains "booking"
    assert _is_in_scope("How do I cancel a booking?", vocab) is True

    # Should pass — contains "client"
    assert _is_in_scope("How do I add a client to the system?", vocab) is True

    # Should fail — no Agon words
    assert _is_in_scope("come si fa la carbonara?", vocab) is False

    # Should fail — Mindbody is not in vocab
    assert _is_in_scope("Tell me about Mindbody software.", vocab) is False

    # Empty vocab always passes (safe fallback)
    assert _is_in_scope("anything at all", set()) is True
