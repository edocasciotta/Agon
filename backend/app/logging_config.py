import logging
import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)(\+?[\d\s\-().]{7,15})(?!\d)")


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


def configure_logging(log_level: str = "INFO") -> None:
    """Apply PII redaction filter to the root logger and set log level."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    pii_filter = PIIRedactionFilter()
    for handler in root.handlers:
        handler.addFilter(pii_filter)
    root.addFilter(pii_filter)
