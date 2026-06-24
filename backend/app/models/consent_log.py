from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class ConsentLog(Base):
    __tablename__ = "consent_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    document_type = Column(String, nullable=False)  # 'privacy_policy' | 'terms_of_service'
    document_version = Column(String, nullable=False)
    accepted_at = Column(DateTime, server_default=func.now(), nullable=False)
    ip_address = Column(String)
