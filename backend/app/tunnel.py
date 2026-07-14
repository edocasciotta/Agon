import asyncio
import logging
import re
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

# cloudflared logs its assigned Quick Tunnel hostname to stderr, e.g.
# "2026-07-14T12:00:00Z INF |  https://random-two-words-123.trycloudflare.com  |"
_TRYCLOUDFLARE_URL_RE = re.compile(r"https://[A-Za-z0-9-]+\.trycloudflare\.com")

# Bounded wait for cloudflared to report its assigned URL. Long enough for a
# cold process start on a slow machine, short enough that backend startup
# never hangs indefinitely on a misbehaving/missing binary.
_STARTUP_TIMEOUT_SECONDS = 20

# Bounded wait for a graceful shutdown (SIGTERM) before escalating to kill()
# (SIGKILL) in stop().
_STOP_TERMINATE_TIMEOUT_SECONDS = 10


class TunnelProvider(ABC):
    @abstractmethod
    async def start(self) -> str: ...

    @abstractmethod
    async def stop(self) -> None: ...

    @abstractmethod
    async def get_url(self) -> Optional[str]: ...

    @abstractmethod
    async def is_running(self) -> bool: ...


class CloudflareTunnelProvider(TunnelProvider):
    """Cloudflare Quick Tunnel provider.

    Spawns `cloudflared tunnel --url <local_url>` as a subprocess. Quick
    Tunnels require zero Cloudflare account/DNS setup — cloudflared picks a
    random `https://*.trycloudflare.com` hostname on each run and prints it
    to **stderr** on startup (there is no separate API call to fetch it).
    This is the only tunnel mode consistent with "zero configuration from
    the studio manager" (see docs/agon_project_bible.md's Local-First /
    Zero Cost by Default principles) — no Cloudflare account, no DNS, no
    named tunnel setup.

    Assumes the `cloudflared` binary is already on PATH. This class does
    NOT attempt to download/install it — if the binary is missing, start()
    logs a clear error and re-raises the underlying FileNotFoundError.
    Bundling the binary with the Electron installer is a separate, later
    frontend/build task.
    """

    def __init__(self, local_url: str = "http://localhost:8000") -> None:
        self._local_url = local_url
        self._process: Optional[asyncio.subprocess.Process] = None
        self._url: Optional[str] = None

    async def start(self) -> str:
        try:
            self._process = await asyncio.create_subprocess_exec(
                "cloudflared",
                "tunnel",
                "--url",
                self._local_url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            logger.error(
                "cloudflared binary not found on PATH. Install cloudflared "
                "(https://developers.cloudflare.com/cloudflare-one/connections/"
                "connect-networks/downloads/) to enable the public tunnel. "
                "The backend will continue running on the LAN only."
            )
            raise

        url = await self._wait_for_url(_STARTUP_TIMEOUT_SECONDS)
        if url is None:
            logger.error(
                "cloudflared did not report a trycloudflare.com URL within "
                "%s seconds; terminating the subprocess.",
                _STARTUP_TIMEOUT_SECONDS,
            )
            await self.stop()
            raise RuntimeError("cloudflared did not report a tunnel URL in time")

        self._url = url
        logger.info("Cloudflare Quick Tunnel started.")
        return url

    async def _wait_for_url(self, timeout_seconds: float) -> Optional[str]:
        """Read cloudflared's stderr line by line until the assigned URL appears.

        Bounded by `timeout_seconds` so a hung or silent process can't block
        backend startup forever.
        """
        if self._process is None or self._process.stderr is None:
            return None
        try:
            return await asyncio.wait_for(
                self._read_url_from_stream(self._process.stderr), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            return None

    @staticmethod
    async def _read_url_from_stream(stream: asyncio.StreamReader) -> Optional[str]:
        """Scan a stream line-by-line for the first trycloudflare.com URL.

        Extracted as a plain async helper (rather than inlined) so tests can
        feed it a fake `asyncio.StreamReader` without spawning a real
        subprocess.
        """
        while True:
            line = await stream.readline()
            if not line:
                return None
            match = _TRYCLOUDFLARE_URL_RE.search(line.decode("utf-8", errors="ignore"))
            if match:
                return match.group(0)

    async def stop(self) -> None:
        process = self._process
        if process is not None and process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=_STOP_TERMINATE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        self._process = None
        self._url = None

    async def get_url(self) -> Optional[str]:
        return self._url

    async def is_running(self) -> bool:
        return self._process is not None and self._process.returncode is None
