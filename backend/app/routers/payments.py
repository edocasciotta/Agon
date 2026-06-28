from app.utils import utcnow
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_client, require_manager, oauth2_scheme, decode_token
from app.models.payment import Payment
from app.models.client import Client
from app.models.membership_type import MembershipType
from app.models.membership import Membership
from app.models.studio_settings import StudioSettings
from app.schemas.payment import PaymentCreate, PaymentResponse, StripeCheckoutRequest
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["payments"])


def _resolve_caller(token: str):
    """Returns (role, subject_id) from token."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Invalid token type"}},
        )
    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )
    return role, int(sub)


def _get_payment_or_404(db: Session, payment_id: int) -> Payment:
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Payment not found"}},
        )
    return p


# Route ordering: specific paths before parameterized
@router.post("/payments/stripe/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    import stripe
    if settings.STRIPE_WEBHOOK_SECRET == "whsec_test":
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "STRIPE_NOT_CONFIGURED", "message": "Stripe webhook secret not configured"}},
        )
    raw_body = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=raw_body, sig_header=sig_header, secret=settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "STRIPE_INVALID_SIGNATURE", "message": "Invalid Stripe webhook signature"}},
        )

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        metadata = session_obj.get("metadata", {})
        client_id = int(metadata.get("client_id", 0))
        membership_type_id = int(metadata.get("membership_type_id", 0))

        mt = db.query(MembershipType).filter(MembershipType.id == membership_type_id).first()
        if mt:
            from datetime import date, timedelta
            today = date.today()
            expires_at = today + timedelta(days=mt.validity_days) if mt.validity_days else None

            membership = Membership(
                client_id=client_id,
                membership_type_id=mt.id,
                status="active",
                starts_at=today,
                expires_at=expires_at,
                credits_remaining=mt.credits_included,
                credits_used=0,
            )
            db.add(membership)
            db.flush()

            payment = Payment(
                client_id=client_id,
                membership_id=membership.id,
                amount=mt.price,
                currency=mt.currency,
                status="completed",
                provider="stripe",
                provider_payment_id=session_obj.get("payment_intent"),
                paid_at=utcnow(),
            )
            db.add(payment)
            db.commit()

    return {"status": "ok"}


@router.post("/payments/stripe/checkout")
def stripe_checkout(
    payload: StripeCheckoutRequest,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client),
):
    import stripe

    studio = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not studio or not studio.stripe_connected or not studio.self_service_purchases_enabled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "STRIPE_NOT_CONFIGURED", "message": "Stripe is not configured or self-service purchases are disabled"}},
        )

    mt = db.query(MembershipType).filter(MembershipType.id == payload.membership_type_id).first()
    if not mt:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Membership type not found"}},
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": mt.currency.lower(),
                    "product_data": {"name": mt.name},
                    "unit_amount": int(mt.price * 100),
                },
                "quantity": 1,
            }],
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            metadata={"client_id": str(current_client.id), "membership_type_id": str(mt.id)},
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "STRIPE_ERROR", "message": str(e)}},
        )


@router.post("/payments/{payment_id}/refund", response_model=PaymentResponse)
def refund_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    p = _get_payment_or_404(db, payment_id)
    if p.status != "completed":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "PAYMENT_CANNOT_REFUND", "message": "Only completed payments can be refunded"}},
        )
    p.status = "refunded"
    db.commit()
    db.refresh(p)
    return p


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    p = _get_payment_or_404(db, payment_id)
    if role not in ("manager", "instructor") and p.client_id != subject_id:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Access denied"}},
        )
    return p


@router.get("/payments", response_model=List[PaymentResponse])
def list_payments(
    client_id: int = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    role, subject_id = _resolve_caller(token)
    if role in ("manager", "instructor"):
        query = db.query(Payment)
        if client_id:
            query = query.filter(Payment.client_id == client_id)
        return query.all()
    else:
        return db.query(Payment).filter(Payment.client_id == subject_id).all()


@router.post("/payments", response_model=PaymentResponse, status_code=201)
def record_manual_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    payment = Payment(
        client_id=payload.client_id,
        membership_id=payload.membership_id,
        amount=payload.amount,
        currency=payload.currency,
        status="completed",
        provider="manual",
        paid_at=utcnow(),
        notes=payload.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
