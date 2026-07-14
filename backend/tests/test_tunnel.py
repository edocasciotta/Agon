"""Tests for the Cloudflare Quick Tunnel provider (app/tunnel.py) and the
AGON_ENV startup gate in main.py.

Never spawns a real `cloudflared` subprocess — asyncio.create_subprocess_exec
is always mocked, and stderr is simulated with real asyncio.StreamReader
instances so the URL-parsing coroutine is exercised for real.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.tunnel import CloudflareTunnelProvider

# pytest.ini sets asyncio_mode = auto, so `async def test_...` functions below
# are collected as asyncio tests automatically — no per-test/module marker
# needed (and none is applied here, since several tests in this file are
# plain sync functions exercising main.py's AGON_ENV gate).


def _fake_stderr(lines: list[bytes]) -> asyncio.StreamReader:
    reader = asyncio.StreamReader()
    for line in lines:
        reader.feed_data(line)
    reader.feed_eof()
    return reader


def _fake_process(stderr: asyncio.StreamReader) -> MagicMock:
    process = MagicMock()
    process.stderr = stderr
    process.returncode = None
    process.terminate = MagicMock()
    process.kill = MagicMock()
    process.wait = AsyncMock(return_value=0)
    return process


# ── URL parsing from stderr ────────────────────────────────────────────────


async def test_read_url_from_stream_parses_trycloudflare_url():
    stream = _fake_stderr(
        [
            b"2026-07-14T12:00:00Z INF Some unrelated cloudflared log line\n",
            b"2026-07-14T12:00:01Z INF |  https://random-two-words-123.trycloudflare.com  |\n",
        ]
    )

    url = await CloudflareTunnelProvider._read_url_from_stream(stream)

    assert url == "https://random-two-words-123.trycloudflare.com"


async def test_read_url_from_stream_returns_none_when_no_url_ever_appears():
    stream = _fake_stderr([b"some irrelevant log line\n", b"another irrelevant line\n"])

    url = await CloudflareTunnelProvider._read_url_from_stream(stream)

    assert url is None


# ── start() ─────────────────────────────────────────────────────────────────


async def test_start_returns_url_from_mocked_subprocess():
    stderr = _fake_stderr([b"INF |  https://foo-bar.trycloudflare.com  |\n"])
    process = _fake_process(stderr)

    provider = CloudflareTunnelProvider()
    with patch("app.tunnel.asyncio.create_subprocess_exec", new=AsyncMock(return_value=process)):
        url = await provider.start()

    assert url == "https://foo-bar.trycloudflare.com"
    assert await provider.get_url() == url
    assert await provider.is_running() is True


async def test_start_raises_when_cloudflared_binary_missing():
    provider = CloudflareTunnelProvider()
    with patch(
        "app.tunnel.asyncio.create_subprocess_exec",
        new=AsyncMock(side_effect=FileNotFoundError()),
    ):
        with pytest.raises(FileNotFoundError):
            await provider.start()


async def test_start_raises_and_terminates_process_when_url_never_appears():
    """No URL is ever written to stderr and the stream never hits EOF — start()
    must not hang forever; it should time out, terminate the process, and
    raise."""
    stderr = asyncio.StreamReader()  # never fed data, never EOF'd
    process = _fake_process(stderr)

    provider = CloudflareTunnelProvider()
    with (
        patch("app.tunnel.asyncio.create_subprocess_exec", new=AsyncMock(return_value=process)),
        patch("app.tunnel._STARTUP_TIMEOUT_SECONDS", 0.05),
    ):
        with pytest.raises(RuntimeError):
            await provider.start()

    process.terminate.assert_called_once()
    assert await provider.is_running() is False


# ── stop() ──────────────────────────────────────────────────────────────────


async def test_stop_terminates_process_cleanly():
    provider = CloudflareTunnelProvider()
    process = _fake_process(asyncio.StreamReader())
    provider._process = process
    provider._url = "https://foo.trycloudflare.com"

    await provider.stop()

    process.terminate.assert_called_once()
    process.wait.assert_awaited_once()
    assert await provider.is_running() is False
    assert await provider.get_url() is None


async def test_stop_is_a_no_op_when_never_started():
    provider = CloudflareTunnelProvider()

    await provider.stop()  # must not raise

    assert await provider.is_running() is False
    assert await provider.get_url() is None


async def test_stop_kills_process_that_does_not_terminate_in_time():
    """If the process doesn't exit within the graceful-terminate window,
    stop() must escalate to kill(). Uses a real (patched-short) timeout and a
    genuinely slow-to-return `wait()` rather than mocking asyncio.wait_for
    itself, so the real asyncio.wait_for cancels/consumes the wait() coroutine
    exactly like it would in production (avoids an orphaned-coroutine
    "never awaited" warning that mocking asyncio.wait_for directly would
    otherwise cause)."""
    provider = CloudflareTunnelProvider()
    process = _fake_process(asyncio.StreamReader())
    call_count = 0

    async def _wait():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            await asyncio.sleep(1)  # never resolves before the patched timeout
        return 0

    process.wait = _wait
    provider._process = process

    with patch("app.tunnel._STOP_TERMINATE_TIMEOUT_SECONDS", 0.05):
        await provider.stop()

    process.terminate.assert_called_once()
    process.kill.assert_called_once()
    assert call_count == 2


# ── AGON_ENV gate (main.py) ─────────────────────────────────────────────────


def test_tunnel_enabled_gate_skips_in_test_env(monkeypatch):
    import main

    monkeypatch.setenv("AGON_ENV", "test")
    assert main._tunnel_enabled() is False


def test_tunnel_enabled_gate_skips_in_development_env(monkeypatch):
    import main

    monkeypatch.setenv("AGON_ENV", "development")
    assert main._tunnel_enabled() is False


def test_tunnel_enabled_gate_active_outside_test_and_development(monkeypatch):
    import main

    monkeypatch.setenv("AGON_ENV", "production")
    assert main._tunnel_enabled() is True


async def test_start_tunnel_never_touches_subprocess_layer_in_test_env():
    """End-to-end confirmation that the gate actually short-circuits
    _start_tunnel(): in AGON_ENV=test (set globally by conftest.py before any
    app import), the subprocess layer must never be touched. This is what
    keeps pytest from spawning a real cloudflared process on every
    TestClient(app) lifespan startup, across the whole suite."""
    import main

    with patch("app.tunnel.asyncio.create_subprocess_exec") as mock_exec:
        await main._start_tunnel()
        mock_exec.assert_not_called()

    assert main._tunnel_provider is None


def test_client_fixture_lifespan_does_not_spawn_tunnel_subprocess(client):
    """Sanity check using the standard `client` fixture (which drives the
    real FastAPI lifespan via TestClient's context manager, per
    conftest.py): app startup must complete without a tunnel process."""
    import main

    assert main._tunnel_provider is None
