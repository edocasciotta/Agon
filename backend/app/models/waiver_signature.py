from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class WaiverSignature(Base):
    """A permanent record of a client digitally signing a Waiver.

    Mirrors the shape of app/models/consent_log.py (client_id, ip_address,
    a created-at-style timestamp) but adds `waiver_version` so the record
    stays tied to the exact text that was agreed to, independent of any
    later edits to the parent Waiver. Signing is a typed full name
    (`signed_name`) — the legally-recognized e-signature pattern already
    used for this codebase's consent log, not a drawn signature.

    Never deduplicated: a client may sign the same waiver_id more than once
    (e.g. re-signing after a version bump) — each signature is its own
    audit-trail row.
    """

    __tablename__ = "waiver_signatures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    waiver_id = Column(Integer, ForeignKey("waivers.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    waiver_version = Column(Integer, nullable=False)
    signed_name = Column(String, nullable=False)
    signed_at = Column(DateTime, server_default=func.now(), nullable=False)
    ip_address = Column(String, nullable=True)
