from app.database import Base
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func


class SmsTemplate(Base):
    __tablename__ = "sms_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    name = Column(String, nullable=False)
    body = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
