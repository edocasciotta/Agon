from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.studio_settings import StudioSettings
from app.models.waitlist import Waitlist
from app.utils import utcnow


def get_studio_settings(db: Session) -> Optional[StudioSettings]:
    """Query StudioSettings where id=1."""
    return db.query(StudioSettings).filter(StudioSettings.id == 1).first()


def get_active_membership(db: Session, client_id: int) -> Optional[Membership]:
    """Returns the first active membership for the client."""
    today = date.today()
    return (
        db.query(Membership)
        .filter(
            Membership.client_id == client_id,
            Membership.status == "active",
            (Membership.expires_at.is_(None)) | (Membership.expires_at >= today),
        )
        .first()
    )


def can_book(db: Session, client_id: int, studio_settings) -> bool:
    """
    Returns True if the client can book:
    - Has an active unlimited membership, OR
    - Has an active membership with credits_remaining > 0, OR
    - Guest bookings are enabled
    """
    guest_enabled = (
        getattr(studio_settings, "guest_bookings_enabled", False) if studio_settings else False
    )

    membership = get_active_membership(db, client_id)
    if membership is None:
        return guest_enabled

    # Load the membership type to check unlimited flag
    mt = db.query(MembershipType).filter(MembershipType.id == membership.membership_type_id).first()
    if mt and mt.unlimited:
        return True

    if membership.credits_remaining is not None and membership.credits_remaining > 0:
        return True

    return guest_enabled


def deduct_credit(db: Session, membership: Optional[Membership]) -> bool:
    """
    Deducts a credit from the membership.
    Returns True if a credit was deducted, False if unlimited (no deduction).
    """
    if membership is None:
        return False

    mt = db.query(MembershipType).filter(MembershipType.id == membership.membership_type_id).first()
    if mt and mt.unlimited:
        return False

    if membership.credits_remaining is not None:
        membership.credits_remaining -= 1
    membership.credits_used = (membership.credits_used or 0) + 1
    return True


def refund_credit(db: Session, membership: Optional[Membership], credit_deducted: bool):
    """
    Refunds a credit to the membership if credit was deducted.
    """
    if membership is None or not credit_deducted:
        return

    if membership.credits_remaining is not None:
        membership.credits_remaining += 1
    membership.credits_used = max(0, (membership.credits_used or 0) - 1)


def calculate_fee(db: Session, client_id: int, fee_type: str) -> float:
    """Calculate the applicable fee for a client.

    fee_type: 'late_cancel' or 'no_show'
    Resolution: MembershipType override > StudioSettings default > 0.0
    """
    membership = get_active_membership(db, client_id)
    if membership is not None:
        mt = (
            db.query(MembershipType)
            .filter(MembershipType.id == membership.membership_type_id)
            .first()
        )
        if mt is not None:
            if fee_type == "late_cancel" and mt.late_cancel_fee_override is not None:
                return mt.late_cancel_fee_override
            if fee_type == "no_show" and mt.no_show_fee_override is not None:
                return mt.no_show_fee_override

    studio_settings = get_studio_settings(db)
    if studio_settings is not None:
        if fee_type == "late_cancel":
            return getattr(studio_settings, "late_cancel_fee", 0.0) or 0.0
        if fee_type == "no_show":
            return getattr(studio_settings, "no_show_fee", 0.0) or 0.0

    return 0.0


def process_waitlist(db: Session, scheduled_class_id: int, studio_settings) -> Optional[Waitlist]:
    """
    Finds the next waiting entry and offers the spot.
    Returns the waitlist entry or None if queue is empty.
    """
    entry = (
        db.query(Waitlist)
        .filter(
            Waitlist.scheduled_class_id == scheduled_class_id,
            Waitlist.status == "waiting",
        )
        .order_by(Waitlist.position.asc())
        .first()
    )

    if entry is None:
        return None

    confirm_minutes = (
        getattr(studio_settings, "waitlist_confirm_minutes", 30) if studio_settings else 30
    )
    now = utcnow()
    entry.status = "offered"
    entry.offered_at = now
    entry.offer_expires_at = now + timedelta(minutes=confirm_minutes)
    entry.updated_at = now
    return entry
