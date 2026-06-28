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
    """Reset module-level docs cache between tests."""
    support_module._DOCS_CONTEXT = None


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
    from app.routers.support import _fallback_reply

    with patch("app.routers.support.completion", side_effect=Exception("LLM unavailable")):
        response = client.post(
            CHAT_URL,
            json={"messages": SAMPLE_MESSAGES},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["reply"] == _fallback_reply("en")


# ─── Pre-screening tests ──────────────────────────────────────────────────────

def test_prescreening_rejects_out_of_scope_without_calling_llm(client, manager_auth_headers):
    """
    A message with no Agon keywords and no question/help words must return
    OUT_OF_SCOPE_REPLY without calling the LLM.
    """
    from app.routers.support import _out_of_scope_reply

    _reset_docs_cache()
    support_module._DOCS_CONTEXT = ""

    with patch("app.routers.support.completion") as mock_llm:
        response = client.post(
            CHAT_URL,
            # No question words, no Agon keywords, more than 3 tokens
            json={"messages": [{"role": "user", "content": "Tell me about Mindbody software please."}]},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    assert response.json()["reply"] == _out_of_scope_reply("en")
    mock_llm.assert_not_called()

    _reset_docs_cache()


def test_prescreening_allows_agon_question(client, manager_auth_headers):
    """
    A question containing an Agon keyword must pass pre-screening and reach the LLM.
    """
    expected_reply = "Go to Calendar, then click the class to manage bookings."

    _reset_docs_cache()
    support_module._DOCS_CONTEXT = ""

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

    # Passes — "how" is a help word
    assert _is_in_scope("How do I cancel a booking?") is True

    # Passes — "aiutami" is an Italian help word
    assert _is_in_scope("aiutami a creare una nuova lezione") is True

    # Passes — "abbonamento" is an Italian Agon keyword
    assert _is_in_scope("come funziona l'abbonamento?") is True

    # Passes — "booking" is an Agon keyword
    assert _is_in_scope("I need help with booking cancellations.") is True

    # Rejected — no question words, no Agon keywords, > 3 tokens
    assert _is_in_scope("Tell me about Mindbody software please.") is False

    # Short messages (≤3 tokens) pass as ambiguous — let LLM decide
    assert _is_in_scope("nice day today") is True
