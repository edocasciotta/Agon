import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_REGISTER_TIMEOUT_SECONDS = 10.0


async def register_with_directory(
    public_studio_id: str, tunnel_url: str, directory_secret: str
) -> None:
    """Register this studio's current tunnel URL with the directory Worker.

    The directory Worker (see directory-worker/CLAUDE.md) is a minimal
    public_studio_id -> tunnel_url lookup so a studio's public widget /
    password-reset links keep resolving even though the Cloudflare Quick
    Tunnel URL changes on every restart. `directory_secret` is sent as a
    bearer credential so only the studio that first claimed this
    public_studio_id can update its registered URL (trust-on-first-use).

    This is a best-effort background step: any failure (network error,
    Worker not yet deployed, non-2xx response) is logged as a warning and
    swallowed — never raised — mirroring the graceful-degradation try/except
    pattern used for LLM calls and other optional external calls elsewhere
    in this codebase (see backend/CLAUDE.md). The backend is fully
    functional on its own LAN without a successful registration; only
    public (internet-facing) widget/reset-password links are affected.

    Never logs `tunnel_url` or `directory_secret` — both are treated as
    sensitive per docs/SECURITY_GUIDELINES.md §5/§8.
    """
    try:
        async with httpx.AsyncClient(timeout=_REGISTER_TIMEOUT_SECONDS) as http_client:
            response = await http_client.post(
                f"{settings.DIRECTORY_WORKER_URL}/register",
                json={"studio_id": public_studio_id, "tunnel_url": tunnel_url},
                headers={"Authorization": f"Bearer {directory_secret}"},
            )
            response.raise_for_status()
        logger.info("Registered tunnel URL with the directory worker.")
    except Exception:
        logger.warning(
            "Failed to register tunnel URL with the directory worker; public "
            "widget/reset-password links may not resolve externally until "
            "the next successful registration.",
            exc_info=True,
        )
