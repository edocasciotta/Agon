import os

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting in test environments so tests are not affected
_enabled = os.environ.get("AGON_ENV", "development") != "test"
limiter = Limiter(key_func=get_remote_address, enabled=_enabled)


def get_jwt_sub(request: Request) -> str:
    """Per-user rate-limit key: JWT 'sub' claim, falls back to remote IP.

    Using the authenticated user id (not IP) prevents a single client account
    from bypassing limits by rotating IPs.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from jose import jwt as _jwt

            from app.config import settings

            token = auth_header.split(" ", 1)[1]
            payload = _jwt.decode(token, settings.AGON_JWT_SECRET, algorithms=["HS256"])
            sub = payload.get("sub")
            if sub is not None:
                return f"user:{sub}"
        except Exception:
            pass
    return get_remote_address(request)
