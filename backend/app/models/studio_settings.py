from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
    checkin_open_minutes_before = Column(Integer, nullable=False, default=30)
    checkin_close_minutes_after = Column(Integer, nullable=False, default=15)
    waitlist_confirm_minutes = Column(Integer, nullable=False, default=30)
    guest_bookings_enabled = Column(Boolean, nullable=False, default=False)
    self_service_purchases_enabled = Column(Boolean, nullable=False, default=True)
    reminder_hours_before = Column(Integer, nullable=False, default=2)
    stripe_account_id = Column(String)
    stripe_connected = Column(Boolean, nullable=False, default=False)
    backup_provider = Column(String)  # 'google_drive' | 'dropbox' | 'local' | None
    backup_token = Column(String)
    last_backup_at = Column(DateTime)
    tunnel_url = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
