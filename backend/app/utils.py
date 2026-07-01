from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException


def raise_api_error(
    code: str,
    message: str,
    status_code: int = 400,
    details: dict[str, Any] | None = None,
) -> None:
    """Raise an HTTPException with the standard Agon error envelope.

    Always use this instead of raising HTTPException directly so the
    response shape is guaranteed to match TECHNICAL_SPEC section 11.
    """
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    raise HTTPException(status_code=status_code, detail={"error": error})


def utcnow() -> datetime:
    """Return current UTC time as a timezone-naive datetime.

    SQLite stores datetimes without timezone info. Using timezone-aware
    datetimes for comparisons with DB fields raises TypeError. This helper
    returns UTC time in the same naive form SQLite uses, so comparisons
    are always consistent.

    Use datetime.now(timezone.utc) only for JWT exp claims (python-jose
    handles timezone-aware datetimes correctly there).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
