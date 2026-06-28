"""
Tests for POST/GET /api/v1/studio/ai (AI setup endpoint).
"""
from unittest.mock import patch, MagicMock


AI_URL = "/api/v1/studio/ai"
VALID_KEY = "AIzaSy_test_key_valid"


def _make_llm_response():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "pong"
    return mock_response


def test_ai_setup_saves_key(client, manager_auth_headers):
    """Valid API key: litellm succeeds, .env is written, returns {success: true}."""
    with patch("app.routers.studio.completion", return_value=_make_llm_response()), \
         patch("app.routers.studio._update_env_file") as mock_write:
        response = client.post(
            AI_URL,
            json={"api_key": VALID_KEY},
            headers=manager_auth_headers,
        )

    assert response.status_code == 200
    assert response.json() == {"success": True}
    mock_write.assert_called_once()
    call_args = mock_write.call_args
    updates = call_args[0][1]
    assert updates["LLM_API_KEY"] == VALID_KEY
    assert updates["LLM_PROVIDER"] == "gemini"
    assert updates["LLM_MODEL"] == "gemini/gemini-1.5-flash"


def test_ai_setup_invalid_key(client, manager_auth_headers):
    """Invalid API key: litellm raises, returns 400 with AI_KEY_INVALID."""
    with patch("app.routers.studio.completion", side_effect=Exception("Invalid API key")):
        response = client.post(
            AI_URL,
            json={"api_key": "bad_key"},
            headers=manager_auth_headers,
        )

    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["error"]["code"] == "AI_KEY_INVALID"
