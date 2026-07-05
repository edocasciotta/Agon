from app.database import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class ConsentLog(Base):
    __tablename__ = "consent_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    consent_type = Column(
        String, nullable=False
    )  # e.g. 'marketing', 'privacy_policy', 'terms_of_service'
    granted = Column(Boolean, nullable=False, default=True)
    ip_address = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
