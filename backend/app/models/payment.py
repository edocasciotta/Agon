from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"))
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="EUR")
    status = Column(String, nullable=False)  # pending|completed|failed|refunded
    provider = Column(String, nullable=False)  # stripe|manual
    provider_payment_id = Column(String)
    provider_invoice_id = Column(String)
    notes = Column(String)
    paid_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
