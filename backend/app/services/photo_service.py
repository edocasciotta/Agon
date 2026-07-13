"""Shared validation/storage helpers for Client and Instructor profile photos.

Security notes (see docs/SECURITY_GUIDELINES.md §4.1):
- Any user-supplied filename is reduced to its basename, filtered through an
  allow-list regex, length-capped, and confirmed (via os.path.commonpath) to
  resolve inside PHOTOS_DIR before ever touching the filesystem. This mirrors
  the exact technique used in app/routers/migration.py — do not diverge.
- Stored filenames are generated server-side (prefix + timestamp + random
  suffix); the client's original filename is never reused beyond extracting
  its extension, so it cannot smuggle a path or collide with another file.
"""

import io
import logging
import os
import re
import secrets
from typing import Optional

from app.utils import raise_api_error, utcnow
from fastapi import UploadFile

logger = logging.getLogger(__name__)

PHOTOS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "photos"
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Formats PIL may report for each allowed extension, used to catch a
# mismatched-extension attack (e.g. an .exe renamed to .jpg).
_FORMAT_BY_EXTENSION = {
    ".jpg": {"JPEG"},
    ".jpeg": {"JPEG"},
    ".png": {"PNG"},
    ".webp": {"WEBP"},
}


def ensure_photos_dir() -> None:
    os.makedirs(PHOTOS_DIR, exist_ok=True)


def _sanitize_component(raw_name: str) -> str:
    """basename -> allow-list -> length cap, per SECURITY_GUIDELINES.md §4.1.

    Identical technique to app/routers/migration.py::analyse_file.
    """
    base = os.path.basename(raw_name or "")
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:100]


def validate_and_save_photo(file: UploadFile, content: bytes, prefix: str) -> str:
    """Validate an uploaded profile photo and persist it under PHOTOS_DIR.

    Validation performed (in order):
    1. Non-empty and under MAX_PHOTO_SIZE_BYTES.
    2. Extension allow-list (derived from the sanitized original filename).
    3. Declared Content-Type allow-list.
    4. Magic-byte / actual-content check via Pillow (Image.open(...).verify()) —
       catches a renamed non-image file even if extension + content-type both
       lie about it.
    5. The detected format must match the claimed extension.

    Returns the generated filename (not a full path) to store in the entity's
    `photo_path` column. Raises the standard API error envelope on failure.
    """
    if not content:
        raise_api_error("PHOTO_EMPTY_FILE", "Uploaded file is empty.", status_code=400)
    if len(content) > MAX_PHOTO_SIZE_BYTES:
        raise_api_error(
            "PHOTO_TOO_LARGE",
            f"Photo exceeds the {MAX_PHOTO_SIZE_BYTES // (1024 * 1024)}MB size limit.",
            status_code=400,
        )

    raw_name = file.filename or ""
    ext = os.path.splitext(_sanitize_component(raw_name))[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise_api_error(
            "PHOTO_INVALID_TYPE",
            "Only .jpg, .jpeg, .png, and .webp files are allowed.",
            status_code=400,
        )

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise_api_error(
            "PHOTO_INVALID_TYPE",
            "Only JPEG, PNG, and WebP images are allowed.",
            status_code=400,
        )

    # Defence in depth: confirm the bytes actually decode as an image of an
    # allowed format, not just a file wearing an image extension/mimetype.
    try:
        from PIL import Image

        with Image.open(io.BytesIO(content)) as img:
            img.verify()
            detected_format = (img.format or "").upper()
    except Exception:
        raise_api_error(
            "PHOTO_INVALID_TYPE",
            "The uploaded file is not a valid image.",
            status_code=400,
        )

    if detected_format not in _FORMAT_BY_EXTENSION.get(ext, set()):
        raise_api_error(
            "PHOTO_INVALID_TYPE",
            "File content does not match its extension.",
            status_code=400,
        )

    ensure_photos_dir()
    safe_prefix = _sanitize_component(prefix) or "photo"
    filename = f"{safe_prefix}_{utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(8)}{ext}"

    photos_abs = os.path.abspath(PHOTOS_DIR)
    saved_path = os.path.join(PHOTOS_DIR, filename)
    # Defence in depth: confirm the resolved path stays inside PHOTOS_DIR.
    if os.path.commonpath([os.path.abspath(saved_path), photos_abs]) != photos_abs:
        raise_api_error("PHOTO_INVALID_FILENAME", "Invalid file name.", status_code=400)

    with open(saved_path, "wb") as f:
        f.write(content)

    return filename


def delete_old_photo(old_filename: Optional[str]) -> None:
    """Best-effort delete of a previously stored photo. Never raises."""
    if not old_filename:
        return
    try:
        safe_name = _sanitize_component(old_filename)
        if not safe_name:
            return
        photos_abs = os.path.abspath(PHOTOS_DIR)
        old_path = os.path.join(PHOTOS_DIR, safe_name)
        if os.path.commonpath([os.path.abspath(old_path), photos_abs]) != photos_abs:
            return
        if os.path.isfile(old_path):
            os.remove(old_path)
    except Exception:
        logger.warning("Failed to delete old profile photo (continuing): %s", old_filename)


def resolve_safe_photo_path(filename: str) -> Optional[str]:
    """Sanitize a requested filename and confirm it resolves inside PHOTOS_DIR.

    Used by the serving route — never trust the path param directly, even
    though it is expected to be one of our own generated filenames.
    Returns the absolute path, or None if the name is invalid/escapes the dir.
    """
    safe_name = _sanitize_component(filename)
    if not safe_name:
        return None
    photos_abs = os.path.abspath(PHOTOS_DIR)
    candidate = os.path.join(PHOTOS_DIR, safe_name)
    if os.path.commonpath([os.path.abspath(candidate), photos_abs]) != photos_abs:
        return None
    return candidate
