from sqlalchemy.orm import Session

from app.models.membership import Membership
from app.models.membership_type import MembershipType


def process_rollover(db: Session, membership: Membership) -> int:
    """Calculate and apply rollover credits when a membership renews.

    Returns the number of credits rolled over.

    Logic:
    1. Get the MembershipType for this membership.
    2. If not rollover_enabled, return 0.
    3. Calculate rollover = min(credits_remaining, max_rollover_credits or credits_remaining).
    4. Set membership.rollover_credits = rollover (audit field).
    5. Reset credits_remaining to credits_per_interval + rollover.
    6. Reset credits_used to 0.

    Does NOT commit.
    """
    mt = db.query(MembershipType).filter(MembershipType.id == membership.membership_type_id).first()
    if mt is None:
        return 0

    # Unlimited memberships or those without credit tracking don't roll over
    if mt.unlimited:
        return 0

    if not mt.rollover_enabled:
        return 0

    # credits_remaining could be None for unlimited-style memberships
    remaining = membership.credits_remaining or 0
    if remaining <= 0:
        membership.rollover_credits = 0
        membership.credits_used = 0
        membership.credits_remaining = mt.credits_per_interval or 0
        return 0

    # Apply cap if configured
    if mt.max_rollover_credits is not None:
        rollover = min(remaining, mt.max_rollover_credits)
    else:
        rollover = remaining

    base_credits = mt.credits_per_interval or 0
    membership.rollover_credits = rollover
    membership.credits_remaining = base_credits + rollover
    membership.credits_used = 0

    return rollover
