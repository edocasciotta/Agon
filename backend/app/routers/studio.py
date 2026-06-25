from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_manager
from app.models.studio_settings import StudioSettings
from app.schemas.studio import StudioSettingsUpdate, StudioSettingsResponse

router = APIRouter(prefix="/api/v1/studio", tags=["studio"])


@router.get("", response_model=StudioSettingsResponse)
def get_studio_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Studio settings not configured"}},
        )
    return settings


@router.put("", response_model=StudioSettingsResponse)
def update_studio_settings(
    payload: StudioSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        # Create with sensible defaults for required fields
        settings = StudioSettings(
            id=1,
            studio_name=payload.studio_name or "My Studio",
            timezone=payload.timezone or "Europe/Rome",
        )
        db.add(settings)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


@router.get("/status")
def get_studio_status(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    tunnel_url = settings.tunnel_url if settings else None
    last_backup_at = settings.last_backup_at if settings else None
    return {
        "tunnel_url": tunnel_url,
        "tunnel_active": tunnel_url is not None,
        "last_backup_at": last_backup_at,
    }


@router.post("/backup")
def trigger_backup(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    return {"status": "ok"}
