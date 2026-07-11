from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.sql import func

from app.database import Base


class PromoCodeUsage(Base):
    __tablename__ = "promo_code_usages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    discount_amount = Column(Float, nullable=False)
    used_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
