from datetime import datetime, timezone


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
