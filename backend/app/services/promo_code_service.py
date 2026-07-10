import json

from sqlalchemy.orm import Session

from app.models.membership_type import MembershipType
from app.models.promo_code import PromoCode
from app.models.promo_code_usage import PromoCodeUsage
from app.utils import raise_api_error, utcnow


def apply_discount(
    original_price: float, discount_type: str, discount_value: float
) -> tuple[float, float]:
    """Calculate discount_amount and final_price. Pure function.

    Returns (discount_amount, final_price). Final price is never negative.
    """
    if discount_type == "percentage":
        discount_amount = round(original_price * discount_value / 100, 2)
    else:  # fixed
        discount_amount = round(discount_value, 2)

    final_price = round(original_price - discount_amount, 2)
    if final_price < 0:
        final_price = 0.0
        discount_amount = round(original_price, 2)

    return discount_amount, final_price


def validate_promo_code(
    db: Session,
    code: str,
    membership_type_id: int,
    client_id: int,
    location_id: int = 1,
) -> tuple[PromoCode, float, float]:
    """Validate a promo code and calculate the discount.

    Returns (promo_code, discount_amount, final_price).
    Raises appropriate errors for invalid/expired/used/wrong-type codes.
    Does NOT commit.
    """
    now = utcnow()

    # 1. Find the promo code
    promo = (
        db.query(PromoCode)
        .filter(
            PromoCode.location_id == location_id,
            PromoCode.code == code,
        )
        .first()
    )
    if promo is None or not promo.is_active:
        raise_api_error(
            "PROMO_CODE_INVALID",
            "Promo code not found or inactive.",
            status_code=404,
        )

    # 2. Check expiry
    if promo.valid_from > now:
        raise_api_error(
            "PROMO_CODE_INVALID",
            "Promo code is not yet valid.",
            status_code=404,
        )
    if promo.valid_until is not None and promo.valid_until < now:
        raise_api_error(
            "PROMO_CODE_EXPIRED",
            "Promo code has expired.",
            status_code=409,
        )

    # 3. Check max uses
    if promo.max_uses is not None and promo.current_uses >= promo.max_uses:
        raise_api_error(
            "PROMO_CODE_MAX_USES",
            "Promo code has reached its maximum number of uses.",
            status_code=409,
        )

    # 4. Check one_per_client
    if promo.one_per_client:
        existing_usage = (
            db.query(PromoCodeUsage)
            .filter(
                PromoCodeUsage.promo_code_id == promo.id,
                PromoCodeUsage.client_id == client_id,
            )
            .first()
        )
        if existing_usage is not None:
            raise_api_error(
                "PROMO_CODE_ALREADY_USED",
                "You have already used this promo code.",
                status_code=409,
            )

    # 5. Check applicable membership types
    if promo.applicable_membership_type_ids is not None:
        try:
            allowed_ids = json.loads(promo.applicable_membership_type_ids)
        except (json.JSONDecodeError, TypeError):
            allowed_ids = []
        if membership_type_id not in allowed_ids:
            raise_api_error(
                "PROMO_CODE_WRONG_TYPE",
                "This promo code is not applicable to the selected membership type.",
                status_code=409,
            )

    # 6. Look up membership type to get the price
    mt = db.query(MembershipType).filter(MembershipType.id == membership_type_id).first()
    if mt is None:
        raise_api_error(
            "MEMBERSHIP_TYPE_NOT_FOUND",
            "Membership type not found.",
            status_code=404,
        )

    original_price = mt.price
    if mt.is_intro_offer and mt.intro_price is not None:
        original_price = mt.intro_price

    discount_amount, final_price = apply_discount(
        original_price, promo.discount_type, promo.discount_value
    )

    return promo, discount_amount, final_price


def record_usage(
    db: Session,
    promo_code_id: int,
    client_id: int,
    discount_amount: float,
    location_id: int = 1,
) -> None:
    """Record that a client used a promo code. Increments current_uses. Does NOT commit."""
    usage = PromoCodeUsage(
        location_id=location_id,
        promo_code_id=promo_code_id,
        client_id=client_id,
        discount_amount=discount_amount,
        used_at=utcnow(),
    )
    db.add(usage)

    promo = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()
    if promo is not None:
        promo.current_uses = (promo.current_uses or 0) + 1
