import os
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from litellm import completion
from app.database import get_db
from app.auth import get_current_user, require_manager
from app.config import settings as app_settings
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


# ─── AI Setup ─────────────────────────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


def _update_env_file(env_path: str, updates: dict) -> None:
    lines = []
    if os.path.exists(env_path):
        with open(env_path) as f:
            lines = f.readlines()

    updated_keys = set()
    new_lines = []
    for line in lines:
        key = line.split("=")[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}\n")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}\n")

    with open(env_path, "w") as f:
        f.writelines(new_lines)


class AISetupRequest(BaseModel):
    api_key: str


@router.get("/ai")
def get_ai_status(current_user=Depends(require_manager)):
    return {"configured": bool(app_settings.LLM_API_KEY)}


@router.post("/ai")
def configure_ai(
    payload: AISetupRequest,
    current_user=Depends(require_manager),
):
    # 1. Validate the key with a test call
    try:
        completion(
            model="gemini/gemini-1.5-flash",
            messages=[{"role": "user", "content": "ping"}],
            api_key=payload.api_key,
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "AI_KEY_INVALID",
                    "message": "The API key is not valid. Please check it and try again.",
                }
            },
        )

    # 2. Persist to .env
    _update_env_file(
        ENV_PATH,
        {
            "LLM_PROVIDER": "gemini",
            "LLM_MODEL": "gemini/gemini-1.5-flash",
            "LLM_API_KEY": payload.api_key,
        },
    )

    # 3. Update in-memory settings
    app_settings.LLM_API_KEY = payload.api_key
    app_settings.LLM_PROVIDER = "gemini"
    app_settings.LLM_MODEL = "gemini/gemini-1.5-flash"

    # 4. Reset docs cache in support router
    import app.routers.support as support_router
    support_router._DOCS_CONTEXT = None

    return {"success": True}
