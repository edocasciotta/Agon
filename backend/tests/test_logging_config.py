import logging
import uuid
from datetime import timedelta

from app.logging_config import AccessLogTokenRedactionFilter
from app.models.client import Client
from app.models.invitation_token import InvitationToken
from app.utils import utcnow
from uvicorn.logging import AccessFormatter


def _make_access_record(full_path: str) -> logging.LogRecord:
    """Build a LogRecord shaped exactly like uvicorn's access logger emits it.

    Mirrors uvicorn.protocols.http.h11_impl.RequestResponseCycle.send: the
    logger call is access_logger.info('%s - "%s %s HTTP/%s" %d', client_addr,
    method, full_path, http_version, status) — msg is the format string and
    args is a positional 5-tuple (client_addr, method, full_path, http_version,
    status_code) that AccessFormatter.formatMessage() unpacks positionally.
    """
    return logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("127.0.0.1:54321", "GET", full_path, "1.1", 200),
        exc_info=None,
    )


def test_access_log_filter_redacts_invite_token():
    """A synthetic uvicorn.access record for the invite endpoint has its token
    replaced with [redacted-token] once run through the real AccessFormatter."""
    token = str(uuid.uuid4())
    record = _make_access_record(f"/api/v1/auth/invite/{token}")

    filt = AccessLogTokenRedactionFilter()
    assert filt.filter(record) is True

    formatter = AccessFormatter(use_colors=False)
    formatted = formatter.format(record)

    assert token not in formatted
    assert "[redacted-token]" in formatted
    assert "/api/v1/auth/invite/[redacted-token]" in formatted


def test_access_log_filter_leaves_unrelated_paths_unchanged():
    """A record for an unrelated path passes through with its path untouched."""
    record = _make_access_record("/api/v1/clients/5")

    filt = AccessLogTokenRedactionFilter()
    assert filt.filter(record) is True

    formatter = AccessFormatter(use_colors=False)
    formatted = formatter.format(record)

    assert "/api/v1/clients/5" in formatted


def test_access_log_filter_passes_through_non_access_shaped_records():
    """Records that aren't a uvicorn-access 5-tuple must pass through unchanged
    rather than raising or assuming the shape."""
    filt = AccessLogTokenRedactionFilter()

    record_no_args = logging.LogRecord(
        name="uvicorn.error",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Started server process [%d]",
        args=(1234,),
        exc_info=None,
    )
    assert filt.filter(record_no_args) is True
    assert record_no_args.args == (1234,)

    record_none_args = logging.LogRecord(
        name="uvicorn.error",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="plain message",
        args=None,
        exc_info=None,
    )
    assert filt.filter(record_none_args) is True
    assert record_none_args.args is None


def test_invite_endpoint_e2e_token_never_appears_in_access_log(client, db_session):
    """End-to-end: hitting the real invite endpoint through TestClient must never
    leak the raw token into the uvicorn.access logger's captured output.

    uvicorn.access has propagate=False, so caplog (which relies on a handler on
    the root logger) would not see these records. Attach a temporary handler
    directly to the uvicorn.access logger instead.
    """
    client_obj = Client(
        email="invitee@example.com",
        password_hash=None,
        full_name="Invitee Person",
        is_active=True,
    )
    db_session.add(client_obj)
    db_session.commit()
    db_session.refresh(client_obj)

    token = str(uuid.uuid4())
    invitation = InvitationToken(
        client_id=client_obj.id,
        token=token,
        used=False,
        expires_at=utcnow() + timedelta(days=7),
    )
    db_session.add(invitation)
    db_session.commit()

    access_logger = logging.getLogger("uvicorn.access")

    import io

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(AccessFormatter(use_colors=False))
    access_logger.addHandler(handler)
    previous_level = access_logger.level
    access_logger.setLevel(logging.INFO)
    try:
        # Simulate what uvicorn's own access logger call looks like for this
        # request (TestClient does not run through a real uvicorn server, so
        # nothing logs to uvicorn.access on its own — we drive the same call
        # uvicorn's h11 implementation makes, through the now-configured
        # filter chain, to prove the end-to-end wiring in configure_logging()
        # works against the real endpoint's token).
        response = client.get(f"/api/v1/auth/invite/{token}")
        assert response.status_code == 200

        access_logger.info(
            '%s - "%s %s HTTP/%s" %d',
            "127.0.0.1:54321",
            "GET",
            f"/api/v1/auth/invite/{token}",
            "1.1",
            response.status_code,
        )
    finally:
        access_logger.removeHandler(handler)
        access_logger.setLevel(previous_level)

    output = stream.getvalue()
    assert token not in output
    assert "[redacted-token]" in output
