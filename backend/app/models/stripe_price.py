from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func

from app.database import Base


class StripePrice(Base):
    __tablename__ = "stripe_prices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    membership_type_id = Column(Integer, ForeignKey("membership_types.id"), nullable=False)
    stripe_product_id = Column(Text, nullable=False)
    stripe_price_id = Column(Text, nullable=False)
    is_recurring = Column(Boolean, nullable=False, default=False)
    billing_interval = Column(Text, nullable=True)  # month | year | None
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
