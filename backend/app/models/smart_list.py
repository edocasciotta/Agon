from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class SmartList(Base):
    __tablename__ = "smart_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    filters = Column(String, nullable=False, default="{}")  # JSON string
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
