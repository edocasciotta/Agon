from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class GiftCard(Base):
    __tablename__ = "gift_cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    code = Column(String, nullable=False, unique=True, index=True)
    initial_value = Column(Float, nullable=False)
    remaining_balance = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="EUR")
    purchaser_client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    recipient_name = Column(String, nullable=True)
    recipient_email = Column(String, nullable=True)
    message = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
