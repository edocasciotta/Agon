"""
Establishments (locations) endpoints.
GET    /api/v1/locations          → list all
POST   /api/v1/locations          → create
PUT    /api/v1/locations/{id}     → update
DELETE /api/v1/locations/{id}     → soft-delete (set is_active=False)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.auth import require_manager
from app.models.location import Location

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class LocationResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=List[LocationResponse])
def list_locations(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    q = db.query(Location)
    if not include_inactive:
        q = q.filter(Location.is_active == True)
    return q.order_by(Location.name).all()


@router.post("", response_model=LocationResponse, status_code=201)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    loc = Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Location not found"}},
        )
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{location_id}", status_code=204)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Location not found"}},
        )
    loc.is_active = False
    db.commit()
