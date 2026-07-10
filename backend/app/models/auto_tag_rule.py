from app.database import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func


class AutoTagRule(Base):
    __tablename__ = "auto_tag_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    trigger_event = Column(String, nullable=False)
    condition_json = Column(String, nullable=True)  # JSON string
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_auto_tag_rule_lookup", "location_id", "trigger_event", "is_active"),
    )
