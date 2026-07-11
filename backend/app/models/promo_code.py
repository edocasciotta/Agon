from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    code = Column(String, nullable=False)
    discount_type = Column(String, nullable=False)  # "percentage" | "fixed"
    discount_value = Column(Float, nullable=False)
    applicable_membership_type_ids = Column(String, nullable=True)  # JSON array or null = all
    max_uses = Column(Integer, nullable=True)  # null = unlimited
    current_uses = Column(Integer, nullable=False, default=0)
    one_per_client = Column(Boolean, nullable=False, default=True)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=True)  # null = no expiry
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("location_id", "code", name="uq_promo_codes_location_code"),
        Index("ix_promo_codes_location_code_active", "location_id", "code", "is_active"),
    )
