from app.database import Base
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String
from sqlalchemy.sql import func


class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    phone = Column(String)
    date_of_birth = Column(Date)
    photo_path = Column(String)
    notes = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)
    expo_push_token = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
