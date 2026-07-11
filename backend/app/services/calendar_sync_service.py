import secrets

from app.models.client import Client
from sqlalchemy.orm import Session

# 32 random bytes, URL-safe base64-encoded. Unlike InvitationToken's
# uuid4()-based one-time token (short-lived, single use), this token is
# long-lived and repeatedly polled by external calendar apps over months, so
# it uses the stronger, purpose-built `secrets` module — token_urlsafe so the
# value can be embedded directly in a URL path segment without encoding.
_TOKEN_BYTES = 32


def get_or_create_calendar_token(db: Session, client_id: int) -> str:
    """Return the client's calendar sync token, generating one if needed.

    Idempotent: if the client already has a token, it is returned unchanged.
    Does NOT commit — caller commits.
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        return None  # caller is responsible for the CLIENT_NOT_FOUND check

    if not client.calendar_sync_token:
        client.calendar_sync_token = secrets.token_urlsafe(_TOKEN_BYTES)
        db.flush()

    return client.calendar_sync_token


def regenerate_calendar_token(db: Session, client_id: int) -> str:
    """Generate a fresh token for the client, discarding the old one.

    The old token value is overwritten in place, so it stops resolving to
    any client immediately (see get_client_by_calendar_token) — this is how
    a client revokes a previously shared/leaked feed URL. Does NOT commit —
    caller commits.
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        return None  # caller is responsible for the CLIENT_NOT_FOUND check

    client.calendar_sync_token = secrets.token_urlsafe(_TOKEN_BYTES)
    db.flush()

    return client.calendar_sync_token


def get_client_by_calendar_token(db: Session, token: str) -> Client | None:
    """Look up a client by their calendar sync token.

    Used by the public (unauthenticated) .ics feed endpoint — the token
    itself is the credential for that endpoint.
    """
    return db.query(Client).filter(Client.calendar_sync_token == token).first()
