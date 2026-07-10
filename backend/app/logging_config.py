import logging
import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)(\+?[\d\s\-().]{7,15})(?!\d)")

# Secret-bearing path prefixes that must never reach stdout in the raw. Each entry
# matches a full request path (as uvicorn's access logger sees it, e.g.
# "/api/v1/auth/invite/<token>?x=1") and replaces the secret segment with a
# placeholder. Add one line per future endpoint that puts a long-lived secret in
# the URL path — no redesign needed.
_ACCESS_LOG_SECRET_PATTERNS = [
    (re.compile(r"(/api/v1/auth/invite/)[^/?#]+"), r"\1[redacted-token]"),
]


class PIIRedactionFilter(logging.Filter):
    """Strip emails and phone numbers from log records before they are emitted.

    We format the full message first (to preserve %d/%s type coercions) and then
    redact PII from the resulting string, storing it back into record.msg with
    empty args so the handler emits the pre-formatted, redacted text.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            # Format the full message respecting the original args
            formatted = record.getMessage()
        except Exception:
            formatted = str(record.msg)
        redacted = self._redact(formatted)
        # Store pre-formatted redacted string; clear args to avoid double-format
        record.msg = redacted
        record.args = None
        return True

    @staticmethod
    def _redact(text: str) -> str:
        text = _EMAIL_RE.sub("[redacted@email]", text)
        text = _PHONE_RE.sub("[redacted-phone]", text)
        return text


class AccessLogTokenRedactionFilter(logging.Filter):
    """Redact secret tokens from uvicorn's access log lines (e.g. the invitation
    token in "GET /api/v1/auth/invite/<token> HTTP/1.1").

    This cannot reuse PIIRedactionFilter's approach of pre-formatting the message
    and setting record.args = None. uvicorn's "uvicorn.access" logger is configured
    with propagate=False and its own "access" handler (see uvicorn.config.
    LOGGING_CONFIG), so records logged through it never reach the root logger where
    PIIRedactionFilter lives — this filter must be attached to "uvicorn.access"
    directly. Worse, uvicorn.logging.AccessFormatter.formatMessage() unpacks
    record.args as a positional 5-tuple
    (client_addr, method, full_path, http_version, status_code); replacing args
    with None (or anything not a 5-tuple) breaks that unpacking with a TypeError,
    which logging swallows by printing "--- Logging error ---" plus a traceback to
    stderr on every request instead of a clean access line. So instead we mutate
    full_path in place at index 2 of the tuple and reassign the tuple, preserving
    its shape for the formatter.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if not (isinstance(args, tuple) and len(args) == 5):
            # Not a uvicorn access-record shape (e.g. reached this filter some
            # other way) — pass through unchanged rather than assume the shape.
            return True
        client_addr, method, full_path, http_version, status_code = args
        full_path = self._redact(str(full_path))
        record.args = (client_addr, method, full_path, http_version, status_code)
        return True

    @staticmethod
    def _redact(path: str) -> str:
        for pattern, replacement in _ACCESS_LOG_SECRET_PATTERNS:
            path = pattern.sub(replacement, path)
        return path


def configure_logging(log_level: str = "INFO") -> None:
    """Apply PII redaction filter to the root logger and set log level.

    Also attaches AccessLogTokenRedactionFilter to the "uvicorn.access" logger
    specifically, since that logger does not propagate to root (see the class
    docstring above). By the time this runs (called from the app's lifespan
    startup), uvicorn has already run its own Config.configure_logging() via
    Config.load() — which happens before Server.startup()/lifespan.startup() in
    uvicorn.server.Server._serve() — so "uvicorn.access" and its "access" handler
    already exist here regardless of import/call order.
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    pii_filter = PIIRedactionFilter()
    for handler in root.handlers:
        handler.addFilter(pii_filter)
    root.addFilter(pii_filter)

    access_logger = logging.getLogger("uvicorn.access")
    token_filter = AccessLogTokenRedactionFilter()
    for handler in access_logger.handlers:
        handler.addFilter(token_filter)
    access_logger.addFilter(token_filter)
