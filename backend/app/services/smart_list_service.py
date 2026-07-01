"""
Smart list filter service.
db.commit() is never called here — that belongs in the router layer.
"""

from datetime import timedelta

from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.client import Client
from app.models.membership import Membership
from app.utils import utcnow


def apply_filters(db: Session, filters: dict) -> list:
    """
    Apply smart list filters and return matching Client objects.

    Supported filters (all optional):
      membership_status: "active" | "expired" | "none"
      last_booked_within_days: int
      not_booked_within_days: int
      joined_before: "YYYY-MM-DD"
      joined_after: "YYYY-MM-DD"
      membership_type_id: int
    """
    from datetime import datetime

    query = db.query(Client).filter(Client.is_active.is_(True))
    now = utcnow()

    membership_status = filters.get("membership_status")
    if membership_status == "active":
        # Has a membership with status="active" and expires_at > now
        query = query.filter(
            exists().where(
                (Membership.client_id == Client.id)
                & (Membership.status == "active")
                & (Membership.expires_at > now)
            )
        )
    elif membership_status == "expired":
        # Has a membership with status="active" and expires_at <= now OR status="expired"
        query = query.filter(
            exists().where(
                (Membership.client_id == Client.id)
                & (
                    ((Membership.status == "active") & (Membership.expires_at <= now))
                    | (Membership.status == "expired")
                )
            )
        )
    elif membership_status == "none":
        # Has no membership rows at all
        query = query.filter(~exists().where(Membership.client_id == Client.id))

    last_booked_within_days = filters.get("last_booked_within_days")
    if last_booked_within_days is not None:
        cutoff = now - timedelta(days=int(last_booked_within_days))
        query = query.filter(
            exists().where(
                (Booking.client_id == Client.id)
                & (Booking.created_at >= cutoff)
                & (Booking.status != "cancelled")
            )
        )

    not_booked_within_days = filters.get("not_booked_within_days")
    if not_booked_within_days is not None:
        cutoff = now - timedelta(days=int(not_booked_within_days))
        query = query.filter(
            ~exists().where(
                (Booking.client_id == Client.id)
                & (Booking.created_at >= cutoff)
                & (Booking.status != "cancelled")
            )
        )

    joined_before = filters.get("joined_before")
    if joined_before:
        before_dt = datetime.strptime(joined_before, "%Y-%m-%d")
        query = query.filter(Client.created_at < before_dt)

    joined_after = filters.get("joined_after")
    if joined_after:
        after_dt = datetime.strptime(joined_after, "%Y-%m-%d")
        query = query.filter(Client.created_at >= after_dt)

    membership_type_id = filters.get("membership_type_id")
    if membership_type_id is not None:
        query = query.filter(
            exists().where(
                (Membership.client_id == Client.id)
                & (Membership.membership_type_id == int(membership_type_id))
            )
        )

    return query.all()
