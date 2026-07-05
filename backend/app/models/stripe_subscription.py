from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.sql import func

from app.database import Base


class StripeSubscription(Base):
    __tablename__ = "stripe_subscriptions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    stripe_subscription_id = Column(Text, nullable=False, unique=True)
    stripe_price_id = Column(Text, nullable=False)
    status = Column(Text, nullable=False)  # active|past_due|canceled|incomplete|unpaid
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (Index("ix_stripe_subscriptions_client_id_status", "client_id", "status"),)
