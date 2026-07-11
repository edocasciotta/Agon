"""
SMS service — sends SMS via Twilio using config from StudioSettings.
db.commit() is never called here.
"""

from app.models.studio_settings import StudioSettings
from sqlalchemy.orm import Session
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client


class SmsSendError(Exception):
    """Raised when the Twilio API call itself fails (config is valid, send failed).

    Kept distinct from ValueError (raised by _get_twilio_config for "not configured")
    so callers can map the two cases to different HTTP status codes/error codes —
    503 SMS_NOT_CONFIGURED vs 502 SMS_SEND_FAILED.
    """


def _get_twilio_config(db: Session) -> StudioSettings:
    """Return StudioSettings row or raise ValueError if Twilio is not configured."""
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        raise ValueError("Studio settings not found")
    if not settings.sms_enabled:
        raise ValueError("SMS is not enabled for this studio")
    if (
        not settings.sms_provider_account_sid
        or not settings.sms_provider_auth_token
        or not settings.sms_from_number
    ):
        raise ValueError(
            "Twilio not configured: sms_provider_account_sid, sms_provider_auth_token, "
            "and sms_from_number are all required"
        )
    return settings


def send_sms(db: Session, to_phone: str, body: str) -> None:
    """Send one SMS via Twilio.

    Raises ValueError if Twilio is not configured, or SmsSendError if the Twilio
    API call itself fails. Never lets a raw TwilioRestException escape.
    """
    cfg = _get_twilio_config(db)

    try:
        client = Client(cfg.sms_provider_account_sid, cfg.sms_provider_auth_token)
        client.messages.create(body=body, from_=cfg.sms_from_number, to=to_phone)
    except TwilioRestException as e:
        raise SmsSendError(f"Failed to send SMS via Twilio: {e.msg}") from e


def send_event_sms(db: Session, event_type: str, to_phone: str, variables: dict) -> None:
    """
    Send an SMS for a named event_type.
    If a custom template is assigned, renders it with {{key}} substitution.
    Otherwise, falls back to a minimal generic message built from the variables dict.
    Does not raise if no template is assigned — SMS may simply be unconfigured
    for a given event type.
    """
    from app.models.sms_event_assignment import SmsEventAssignment
    from app.models.sms_template import SmsTemplate

    assignment = (
        db.query(SmsEventAssignment).filter(SmsEventAssignment.event_type == event_type).first()
    )

    if assignment and assignment.template_id:
        tmpl = db.query(SmsTemplate).filter(SmsTemplate.id == assignment.template_id).first()
        if tmpl:
            rendered_body = tmpl.body
            for key, value in variables.items():
                placeholder = "{{" + key + "}}"
                rendered_body = rendered_body.replace(placeholder, str(value))
            send_sms(db, to_phone, rendered_body)
            return

    # No custom template — build a minimal generic message from the variables dict
    body = "\n".join(f"{k}: {v}" for k, v in variables.items())
    send_sms(db, to_phone, body)


def send_test_sms(db: Session, to_phone: str, studio_name: str) -> None:
    """Send a test SMS to verify Twilio configuration."""
    body = f"This is a test SMS from {studio_name}. Your Twilio settings are working correctly."
    send_sms(db, to_phone, body)
