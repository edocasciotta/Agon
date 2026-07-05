from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func


class Waitlist(Base):
    __tablename__ = "waitlist"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    scheduled_class_id = Column(Integer, ForeignKey("scheduled_classes.id"), nullable=False)
    position = Column(Integer, nullable=False)
    status = Column(
        String, nullable=False, default="waiting"
    )  # waiting|offered|confirmed|expired|declined
    offered_at = Column(DateTime)
    offer_expires_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("client_id", "scheduled_class_id"),)
