import os

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.auth import require_authenticated
from app.services.photo_service import resolve_safe_photo_path
from app.utils import raise_api_error

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])


@router.get("/{filename}")
def get_photo(
    filename: str,
    _payload=Depends(require_authenticated),
):
    """Serve a previously-uploaded profile photo (client or instructor).

    Any authenticated role (manager/instructor/client) may fetch any photo —
    profile photos are visible across the studio (e.g. a client viewing an
    instructor's profile), not owner-restricted. Unauthenticated requests are
    rejected (401).

    The filename path param is never trusted directly: it is sanitized
    (basename + allow-list + commonpath containment check) before being used
    to build a filesystem path, per docs/SECURITY_GUIDELINES.md §4.1 — defence
    in depth even though it is expected to be one of our own generated names.
    """
    safe_path = resolve_safe_photo_path(filename)
    if not safe_path or not os.path.isfile(safe_path):
        raise_api_error("PHOTO_NOT_FOUND", "Photo not found", status_code=404)

    return FileResponse(safe_path)
