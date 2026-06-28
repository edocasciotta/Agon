from app.utils import utcnow
import csv
import io
import json
import logging
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Agon's canonical schema fields by entity type
AGON_CLIENT_FIELDS = ["full_name", "email", "phone", "date_of_birth"]
AGON_MEMBERSHIP_FIELDS = ["client_email", "membership_type_name", "starts_at", "expires_at", "credits_remaining"]
AGON_CLASS_FIELDS = ["class_name", "starts_at", "ends_at", "capacity", "instructor_name"]


def detect_file_format(filename: str, content: bytes) -> str:
    """Detect CSV or JSON."""
    if filename.endswith(".json"):
        return "json"
    return "csv"


def parse_csv_headers(content: bytes) -> list[str]:
    """Return the column headers from a CSV file."""
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    headers = next(reader, [])
    return [h.strip() for h in headers]


def parse_csv_rows(content: bytes) -> list[dict]:
    """Parse all rows from a CSV file as list of dicts."""
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def llm_map_columns(source_headers: list[str], target_fields: list[str]) -> dict:
    """
    Use LLM to map source CSV columns to Agon's canonical fields.
    Returns {"source_col": "agon_field" or null, ...}
    Falls back to exact-match heuristics if LLM is unavailable.
    """
    from app.config import settings

    # First try exact/fuzzy match without LLM
    mapping = {}
    target_lower = {f.lower(): f for f in target_fields}
    for col in source_headers:
        key = col.lower().replace(" ", "_").replace("-", "_")
        if key in target_lower:
            mapping[col] = target_lower[key]
        else:
            mapping[col] = None

    # If all mapped without LLM, return early
    unmapped = [c for c, v in mapping.items() if v is None]
    if not unmapped:
        return mapping

    # Try LLM for unmapped columns
    try:
        from litellm import completion
        prompt = f"""You are a data migration assistant. Map these CSV column headers to Agon's fields.

Source columns (unmapped): {unmapped}
Target Agon fields: {target_fields}

Return ONLY a JSON object mapping source column name → Agon field name (or null if no match).
Example: {{"First Name": "full_name", "DOB": "date_of_birth", "Notes": null}}"""

        response = completion(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            api_key=settings.LLM_API_KEY if settings.LLM_API_KEY else None,
        )
        raw = response.choices[0].message.content.strip()
        # Extract JSON from response (LLM may add markdown)
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        llm_mapping = json.loads(raw)
        for col, field in llm_mapping.items():
            if col in mapping:
                mapping[col] = field if field in target_fields else None
    except Exception as e:
        logger.warning(f"LLM column mapping failed (using heuristics only): {e}")

    return mapping


def execute_client_import(db: Session, rows: list[dict], column_mapping: dict, job_id: int) -> tuple[int, int, list[str]]:
    """
    Import client rows. Returns (imported_count, skipped_count, skipped_reasons).
    """
    from app.models.client import Client
    from app.auth import hash_password

    imported = 0
    skipped = 0
    reasons = []
    reverse_map = {v: k for k, v in column_mapping.items() if v}  # agon_field -> source_col

    for row in rows:
        email_col = reverse_map.get("email")
        if not email_col or not row.get(email_col):
            skipped += 1
            reasons.append(f"Row missing email: {row}")
            continue

        email = row[email_col].strip().lower()
        existing = db.query(Client).filter(Client.email == email).first()
        if existing:
            skipped += 1
            reasons.append(f"Duplicate email skipped: {email}")
            continue

        full_name_col = reverse_map.get("full_name")
        phone_col = reverse_map.get("phone")
        dob_col = reverse_map.get("date_of_birth")

        c = Client(
            email=email,
            full_name=(row.get(full_name_col, "").strip() if full_name_col else email),
            phone=(row.get(phone_col, "").strip() or None) if phone_col else None,
            password_hash=hash_password(secrets.token_urlsafe(16)),
            is_active=True,
        )
        db.add(c)
        imported += 1

    return imported, skipped, reasons


def generate_invitation_tokens(db: Session, client_ids: list[int], studio_settings) -> list[dict]:
    """
    For each client, generate an invitation token and build the invite URL.
    Returns list of {"client_id", "token", "invite_url"}.
    """
    from app.models.invitation_token import InvitationToken

    results = []
    tunnel_url = studio_settings.tunnel_url if studio_settings and studio_settings.tunnel_url else "http://localhost:8000"
    expires = utcnow() + timedelta(days=7)

    for client_id in client_ids:
        token = str(uuid.uuid4())
        inv = InvitationToken(client_id=client_id, token=token, expires_at=expires)
        db.add(inv)
        results.append({
            "client_id": client_id,
            "token": token,
            "invite_url": f"{tunnel_url}/invite/{token}",
        })

    return results
