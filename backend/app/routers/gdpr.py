from app.auth import decode_token, oauth2_scheme
from app.database import get_db
from app.schemas.gdpr import ConsentRequest, ConsentResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/gdpr", tags=["gdpr"])


def _get_caller(token: str, db: Session):
    """
    Decode the token and return (caller, role) where role is 'manager'/'user' or 'client'.
    Uses the 'role' claim in the JWT to decide which table to query.
    Raises 401 if the token is invalid.
    """
    from app.models.client import Client
    from app.models.user import User

    payload = decode_token(token)
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Token missing subject"}},
        )

    jwt_role = payload.get("role", "")

    if jwt_role == "client":
        client = db.query(Client).filter(Client.id == int(sub)).first()
        if client:
            return client, "client"
    else:
        # manager or instructor token — look in users table
        user = db.query(User).filter(User.id == int(sub)).first()
        if user and user.is_active:
            return user, "manager" if user.role == "manager" else "user"

    raise HTTPException(
        status_code=401,
        detail={"error": {"code": "AUTH_TOKEN_INVALID", "message": "Caller not found"}},
    )


def _require_manager_or_own_client(client_id: int, token: str, db: Session):
    """Ensures caller is a manager or the client themselves."""
    caller, role = _get_caller(token, db)
    if role == "manager":
        return caller
    if role == "client" and caller.id == client_id:
        return caller
    raise HTTPException(
        status_code=403,
        detail={"error": {"code": "AUTH_INSUFFICIENT_PERMISSIONS", "message": "Access denied"}},
    )


@router.get("/export/{client_id}")
def gdpr_export(
    client_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    from app.models.booking import Booking
    from app.models.checkin import Checkin
    from app.models.client import Client
    from app.models.consent_log import ConsentLog
    from app.models.membership import Membership
    from app.models.payment import Payment

    _require_manager_or_own_client(client_id, token, db)

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    def to_dict(obj):
        d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        # Convert non-serializable types
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        return d

    return {
        "client": to_dict(client),
        "bookings": [
            to_dict(b) for b in db.query(Booking).filter(Booking.client_id == client_id).all()
        ],
        "memberships": [
            to_dict(m) for m in db.query(Membership).filter(Membership.client_id == client_id).all()
        ],
        "payments": [
            to_dict(p) for p in db.query(Payment).filter(Payment.client_id == client_id).all()
        ],
        "checkins": [
            to_dict(ci) for ci in db.query(Checkin).filter(Checkin.client_id == client_id).all()
        ],
        "consent_log": [
            to_dict(cl)
            for cl in db.query(ConsentLog).filter(ConsentLog.client_id == client_id).all()
        ],
    }


@router.post("/delete/{client_id}")
def gdpr_delete(
    client_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    from app.models.booking import Booking
    from app.models.client import Client
    from app.models.membership import Membership

    _require_manager_or_own_client(client_id, token, db)

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )

    # Cancel active memberships
    db.query(Membership).filter(
        Membership.client_id == client_id,
        Membership.status == "active",
    ).update({"status": "cancelled"})

    # Cancel confirmed bookings
    db.query(Booking).filter(
        Booking.client_id == client_id,
        Booking.status == "confirmed",
    ).update({"status": "cancelled"})

    # Anonymize client
    client.full_name = "[deleted]"
    client.email = f"deleted_{client_id}@anon.agon"
    client.phone = None
    client.date_of_birth = None
    client.notes = None
    client.password_hash = "[deleted]"
    client.expo_push_token = None
    client.is_active = False

    db.commit()

    return {"status": "deleted", "client_id": client_id}


@router.get("/consent-log/{client_id}")
def get_consent_log(
    client_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    from app.models.consent_log import ConsentLog

    _require_manager_or_own_client(client_id, token, db)

    entries = (
        db.query(ConsentLog)
        .filter(ConsentLog.client_id == client_id)
        .order_by(ConsentLog.created_at.desc())
        .all()
    )
    return [ConsentResponse.model_validate(e) for e in entries]


@router.post("/consent", status_code=201, response_model=ConsentResponse)
def record_consent(
    payload: ConsentRequest,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    from app.models.consent_log import ConsentLog

    caller, role = _get_caller(token, db)
    if role != "client":
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                    "message": "Client access required",
                }
            },
        )

    entry = ConsentLog(
        client_id=caller.id,
        consent_type=payload.consent_type,
        granted=payload.granted,
        ip_address=payload.ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
