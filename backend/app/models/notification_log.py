from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class NotificationLog(Base):
    __tablename__ = "notification_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    status = Column(String, nullable=False)  # sent|failed|pending
    expo_ticket_id = Column(String)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
