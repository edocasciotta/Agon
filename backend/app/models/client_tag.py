from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func


class ClientTag(Base):
    __tablename__ = "client_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    assigned_at = Column(DateTime, nullable=False)
    assigned_by = Column(String, nullable=False)  # "manual" or "auto"
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("client_id", "tag_id", name="uq_client_tag"),)
