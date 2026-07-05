from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func

from app.database import Base


class StripeCustomer(Base):
    __tablename__ = "stripe_customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    stripe_customer_id = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
