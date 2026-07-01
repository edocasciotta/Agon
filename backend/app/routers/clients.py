import uuid
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_client, get_current_user, require_manager, require_staff
from app.database import get_db
from app.models.booking import Booking
from app.models.client import Client
from app.models.invitation_token import InvitationToken
from app.models.membership import Membership
from app.models.studio_settings import StudioSettings
from app.schemas.client import (
    ClientCreate,
    ClientCreateResponse,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)
from app.utils import utcnow

router = APIRouter(prefix="/api/v1/clients", tags=["clients"])


# ---- /me routes MUST come before /{id} ----


@router.get("/me", response_model=ClientResponse)
def get_own_profile(
    current_client: Client = Depends(get_current_client),
):
    return current_client


@router.put("/me", response_model=ClientResponse)
def update_own_profile(
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_client, field, value)
    db.commit()
    db.refresh(current_client)
    return current_client


@router.put("/me/push-token")
def update_push_token(
    payload: dict,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    push_token = payload.get("push_token")
    if push_token is None:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "push_token is required"}},
        )
    current_client.expo_push_token = push_token
    db.commit()
    return {"status": "ok"}


# ---- Collection and /{id} routes ----


@router.get("", response_model=List[ClientListResponse])
def list_clients(
    search: Optional[str] = Query(None),
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
):
    query = db.query(Client)
    if active_only:
        query = query.filter(Client.is_active.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.filter((Client.full_name.ilike(pattern)) | (Client.email.ilike(pattern)))
    return query.all()


@router.post("", response_model=ClientCreateResponse, status_code=201)
async def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    """Create a client from the backoffice (no password yet). Sends invitation email."""
    existing = db.query(Client).filter(Client.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "CLIENT_EMAIL_ALREADY_EXISTS",
                    "message": "A client with this email already exists",
                }
            },
        )

    client = Client(
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        password_hash=None,
    )
    db.add(client)
    db.flush()  # get client.id without committing

    # Generate invitation token
    token_str = str(uuid.uuid4())
    invitation = InvitationToken(
        client_id=client.id,
        token=token_str,
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(invitation)

    # Build invite URL
    studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    base_url = (
        studio_settings.tunnel_url
        if studio_settings and studio_settings.tunnel_url
        else "http://localhost:5173"
    )
    invite_url = f"{base_url}/set-password?token={token_str}"
    studio_name = studio_settings.studio_name if studio_settings else "Agon Studio"

    # Try to send email
    email_sent = False
    try:
        from app.services.email_service import send_event_email

        await send_event_email(
            db,
            "client_invite",
            client.email,
            client.full_name,
            {"invite_url": invite_url, "studio_name": studio_name, "client_name": client.full_name},
            studio_name,
        )
        email_sent = True
    except Exception:
        pass  # Don't fail if email sending fails

    db.commit()
    db.refresh(client)

    result = ClientCreateResponse(
        id=client.id,
        email=client.email,
        full_name=client.full_name,
        phone=client.phone,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        email_sent=email_sent,
    )
    return result


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}")
def anonymize_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    # GDPR anonymize — keep row for booking history integrity
    client.full_name = "[deleted]"
    client.email = f"deleted_{client_id}@anon.agon"
    client.phone = None
    client.date_of_birth = None
    client.notes = None
    client.is_active = False
    db.commit()
    return {"status": "anonymized"}


@router.get("/{client_id}/bookings")
def get_client_bookings(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    bookings = db.query(Booking).filter(Booking.client_id == client_id).all()
    return [
        {
            "id": b.id,
            "scheduled_class_id": b.scheduled_class_id,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in bookings
    ]


@router.get("/{client_id}/memberships")
def get_client_memberships(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Client not found"}},
        )
    memberships = db.query(Membership).filter(Membership.client_id == client_id).all()
    return [
        {
            "id": m.id,
            "membership_type_id": m.membership_type_id,
            "status": m.status,
            "starts_at": m.starts_at,
            "expires_at": m.expires_at,
            "credits_remaining": m.credits_remaining,
        }
        for m in memberships
    ]
