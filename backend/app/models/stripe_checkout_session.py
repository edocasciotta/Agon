from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.sql import func

from app.database import Base


class StripeCheckoutSession(Base):
    __tablename__ = "stripe_checkout_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    stripe_session_id = Column(Text, nullable=False, unique=True)
    membership_type_id = Column(Integer, ForeignKey("membership_types.id"), nullable=False)
    mode = Column(Text, nullable=False, default="payment")  # payment | subscription
    status = Column(Text, nullable=False, default="open")  # open | complete | expired
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_stripe_checkout_sessions_client_id_status", "client_id", "status"),)
