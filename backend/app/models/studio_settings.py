import secrets
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class StudioSettings(Base):
    __tablename__ = "studio_settings"
    id = Column(Integer, primary_key=True, default=1)
    location_id = Column(Integer, nullable=False, default=1)
    studio_name = Column(String, nullable=False)
    address = Column(String)
    timezone = Column(String, nullable=False, default="Europe/Rome")
    logo_path = Column(String)
    cancellation_hours = Column(Integer, nullable=False, default=2)
    cancellation_deducts_credit = Column(Boolean, nullable=False, default=False)
    late_cancel_fee = Column(Float, nullable=False, default=0.0)
    no_show_fee = Column(Float, nullable=False, default=0.0)
    checkin_open_minutes_before = Column(Integer, nullable=False, default=30)
    checkin_close_minutes_after = Column(Integer, nullable=False, default=15)
    waitlist_confirm_minutes = Column(Integer, nullable=False, default=30)
    guest_bookings_enabled = Column(Boolean, nullable=False, default=False)
    self_service_purchases_enabled = Column(Boolean, nullable=False, default=True)
    reminder_hours_before = Column(Integer, nullable=False, default=2)
    calendar_start_hour = Column(Integer, nullable=False, default=7)
    calendar_end_hour = Column(Integer, nullable=False, default=21)
    primary_color = Column(String)
    secondary_color = Column(String)
    stripe_account_id = Column(String)
    stripe_connected = Column(Boolean, nullable=False, default=False)
    backup_provider = Column(String)  # 'google_drive' | 'dropbox' | 'local' | None
    backup_token = Column(String)
    last_backup_at = Column(DateTime)
    tunnel_url = Column(String)
    # Public identity for the widget / directory-Worker trust boundary. This
    # UUID — never the internal integer `id` — is the only studio identifier
    # ever exposed publicly (embeddable widget URLs, the directory Worker's
    # studio_id -> tunnel_url lookup). Generated once via uuid4() so it can't
    # be enumerated/guessed the way a sequential integer id could.
    public_studio_id = Column(
        String, unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    # Bearer credential sent as `Authorization: Bearer {directory_secret}` to
    # the directory Worker's POST /register (see directory-worker/CLAUDE.md)
    # so only the studio that first claimed a public_studio_id can update its
    # registered tunnel URL (trust-on-first-use). Mirrors the
    # secrets.token_urlsafe(32) generation style already used for the
    # calendar-sync token in app/services/calendar_sync_service.py. Never
    # returned by any API response and never logged (see
    # app/logging_config.py's PII/secret redaction).
    directory_secret = Column(String, nullable=False, default=lambda: secrets.token_urlsafe(32))
    email_smtp_host = Column(String)
    email_smtp_port = Column(Integer, default=587)
    email_smtp_user = Column(String)
    email_smtp_password = Column(String)
    email_from_name = Column(String)
    email_from_address = Column(String)
    email_smtp_tls = Column(Boolean, default=True)
    sms_provider_account_sid = Column(String)
    sms_provider_auth_token = Column(String)
    sms_from_number = Column(String)
    sms_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
