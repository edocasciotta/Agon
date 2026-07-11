import random
import string

from sqlalchemy.orm import Session

from app.models.gift_card import GiftCard
from app.models.gift_card_redemption import GiftCardRedemption
from app.utils import raise_api_error, utcnow

_CODE_CHARS = string.ascii_uppercase + string.digits
_CODE_RANDOM_LEN = 8
_MAX_CODE_ATTEMPTS = 10


def generate_gift_card_code(db: Session) -> str:
    """Generate a unique gift card code of the form GC-XXXXXXXX.

    XXXXXXXX is 8 random uppercase alphanumeric characters, generated
    server-side. Retries on collision against existing codes in the DB.
    """
    for _ in range(_MAX_CODE_ATTEMPTS):
        candidate = "GC-" + "".join(random.choices(_CODE_CHARS, k=_CODE_RANDOM_LEN))
        existing = db.query(GiftCard).filter(GiftCard.code == candidate).first()
        if existing is None:
            return candidate
    # Extremely unlikely with 36^8 combinations, but fail loudly rather than
    # ever returning a colliding code.
    raise_api_error(
        "GIFT_CARD_CODE_GENERATION_FAILED",
        "Could not generate a unique gift card code. Please try again.",
        status_code=500,
    )


def validate_gift_card(db: Session, code: str, location_id: int = 1) -> GiftCard:
    """Validate a gift card code and return the GiftCard row if usable.

    Does NOT deduct any balance or record a redemption — read-only check.
    Raises the appropriate GIFT_CARD_* error if invalid.
    """
    gift_card = (
        db.query(GiftCard)
        .filter(GiftCard.location_id == location_id, GiftCard.code == code)
        .first()
    )
    if gift_card is None:
        raise_api_error(
            "GIFT_CARD_NOT_FOUND",
            "Gift card not found.",
            status_code=404,
        )

    if not gift_card.is_active:
        raise_api_error(
            "GIFT_CARD_INACTIVE",
            "This gift card has been deactivated.",
            status_code=400,
        )

    if gift_card.expires_at is not None and gift_card.expires_at < utcnow():
        raise_api_error(
            "GIFT_CARD_EXPIRED",
            "This gift card has expired.",
            status_code=400,
        )

    if gift_card.remaining_balance <= 0:
        raise_api_error(
            "GIFT_CARD_ZERO_BALANCE",
            "This gift card has no remaining balance.",
            status_code=400,
        )

    return gift_card


def redeem_gift_card(
    db: Session,
    code: str,
    client_id: int,
    amount: float,
    location_id: int = 1,
    stripe_checkout_session_id: str | None = None,
) -> tuple[GiftCard, GiftCardRedemption]:
    """Redeem (spend) a gift card, deducting up to `amount` from its balance.

    Validates the gift card first. Deducts min(amount, remaining_balance) so
    the balance never goes negative. Creates a GiftCardRedemption row.
    Does NOT commit — caller commits.
    """
    gift_card = validate_gift_card(db, code, location_id=location_id)

    amount_to_deduct = min(amount, gift_card.remaining_balance)
    gift_card.remaining_balance = round(gift_card.remaining_balance - amount_to_deduct, 2)

    redemption = GiftCardRedemption(
        location_id=location_id,
        gift_card_id=gift_card.id,
        client_id=client_id,
        amount=amount_to_deduct,
        balance_after=gift_card.remaining_balance,
        stripe_checkout_session_id=stripe_checkout_session_id,
        redeemed_at=utcnow(),
    )
    db.add(redemption)
    db.flush()

    return gift_card, redemption
