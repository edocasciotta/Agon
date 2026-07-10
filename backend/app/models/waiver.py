from app.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func


class Waiver(Base):
    """A manager-authored waiver/consent document (e.g. Liability Waiver).

    Editing `body` bumps `version` — see app/routers/waivers.py::update_waiver.
    `version` records what text a signature actually applied to; existing
    WaiverSignature rows keep the version they were signed at even after the
    waiver's own `version` moves on (see app/models/waiver_signature.py).
    """

    __tablename__ = "waivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    requires_before_booking = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
