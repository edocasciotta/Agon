from sqlalchemy.orm import Session

from app.models.membership import Membership
from app.models.membership_type import MembershipType


def can_use_intro_offer(db: Session, client_id: int, location_id: int = 1) -> bool:
    """Check if client has ever had ANY intro offer membership at this location.

    Returns True if they've never used an intro offer, False if they have.

    Logic:
    1. Query all MembershipType IDs where is_intro_offer=True and location_id matches.
    2. Check if any Membership exists for this client_id with any of those type IDs.
    3. If yes, return False (already used). If no, return True.

    Does NOT commit.
    """
    intro_type_ids = (
        db.query(MembershipType.id)
        .filter(
            MembershipType.is_intro_offer.is_(True),
            MembershipType.location_id == location_id,
        )
        .all()
    )
    if not intro_type_ids:
        # No intro offers defined at this location — vacuously eligible
        return True

    type_ids = [row[0] for row in intro_type_ids]

    existing = (
        db.query(Membership.id)
        .filter(
            Membership.client_id == client_id,
            Membership.membership_type_id.in_(type_ids),
        )
        .first()
    )

    return existing is None
