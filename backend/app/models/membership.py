from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Membership(Base):
    __tablename__ = "memberships"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    membership_type_id = Column(Integer, ForeignKey("membership_types.id"), nullable=False)
    status = Column(
        String, nullable=False, default="active"
    )  # active|expired|cancelled|paused|payment_overdue
    starts_at = Column(Date, nullable=False)
    expires_at = Column(Date)
    credits_remaining = Column(Integer)
    credits_used = Column(Integer, nullable=False, default=0)
    paused_at = Column(DateTime)
    pause_ends_at = Column(DateTime)
    stripe_subscription_id = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
