"""
Phase 11.2 — AI Support Agent
3 tests: success, unauthenticated, LLM error fallback.
"""
from unittest.mock import patch, MagicMock
import pytest


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
