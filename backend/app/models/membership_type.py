from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class MembershipType(Base):
    __tablename__ = "membership_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    name = Column(String, nullable=False)
    description = Column(String)
    type = Column(String, nullable=False)  # 'recurring' | 'credit_pack'
    price = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="EUR")
    billing_interval = Column(String)  # 'weekly' | 'monthly' | 'annual'
    credits_included = Column(Integer)
    credits_per_interval = Column(Integer)
    unlimited = Column(Boolean, nullable=False, default=False)
    validity_days = Column(Integer)
    can_pause = Column(Boolean, nullable=False, default=False)
    max_pause_days = Column(Integer)
    applicable_class_types = Column(String)  # JSON string or None (all)
    rollover_enabled = Column(Boolean, nullable=False, default=False)
    max_rollover_credits = Column(Integer, nullable=True)
    late_cancel_fee_override = Column(Float, nullable=True)
    no_show_fee_override = Column(Float, nullable=True)
    is_intro_offer = Column(Boolean, nullable=False, default=False)
    intro_price = Column(Float, nullable=True)
    intro_validity_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sellable_online = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
