from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.auth import get_current_user, get_current_client, require_manager
from app.models.client import Client
from app.models.booking import Booking
from app.models.membership import Membership
from app.schemas.client import ClientResponse, ClientUpdate, ClientListResponse

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
    current_user=Depends(get_current_user),
):
    query = db.query(Client)
    if active_only:
        query = query.filter(Client.is_active == True)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Client.full_name.ilike(pattern)) | (Client.email.ilike(pattern))
        )
    return query.all()


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
