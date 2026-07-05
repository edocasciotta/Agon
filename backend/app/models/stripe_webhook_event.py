from sqlalchemy import Column, DateTime, Text
from sqlalchemy.sql import func

from app.database import Base


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"
    stripe_event_id = Column(Text, primary_key=True)
    event_type = Column(Text, nullable=False)
    processed_at = Column(DateTime, server_default=func.now(), nullable=False)
