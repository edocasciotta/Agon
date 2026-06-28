from app.utils import utcnow
import csv
import io
import json
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import require_manager
from app.models.migration_job import MigrationJob
from app.models.invitation_token import InvitationToken
from app.models.client import Client
from app.models.studio_settings import StudioSettings
from app.services.migration_service import (
    detect_file_format,
    parse_csv_headers,
    parse_csv_rows,
    llm_map_columns,
    execute_client_import,
    generate_invitation_tokens,
    AGON_CLIENT_FIELDS,
    AGON_MEMBERSHIP_FIELDS,
    AGON_CLASS_FIELDS,
)

router = APIRouter(prefix="/api/v1/migration", tags=["migration"])

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


def ensure_uploads_dir():
    os.makedirs(UPLOADS_DIR, exist_ok=True)


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class ConfirmImportRequest(BaseModel):
    job_id: int
    column_mapping: dict


class SendInvitationsRequest(BaseModel):
    job_id: int
    client_ids: Optional[list[int]] = None


# ─── Templates ───────────────────────────────────────────────────────────────

TEMPLATES = {
    "clients": {
        "headers": ["full_name", "email", "phone", "date_of_birth"],
        "example": ["John Doe", "john@example.com", "+39123456789", "1990-01-15"],
    },
    "memberships": {
        "headers": ["client_email", "membership_type_name", "starts_at", "expires_at", "credits_remaining"],
        "example": ["john@example.com", "10-Class Pack", "2024-01-01", "2024-12-31", "10"],
    },
    "classes": {
        "headers": ["class_name", "starts_at", "ends_at", "capacity", "instructor_name"],
        "example": ["Yoga Flow", "2024-06-01 09:00:00", "2024-06-01 10:00:00", "15", "Jane Smith"],
    },
}


@router.get("/templates/{type}")
async def download_template(
    type: str,
    _=Depends(require_manager),
):
    if type not in TEMPLATES:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TEMPLATE_NOT_FOUND", "message": f"Template type '{type}' not found"}},
        )
    tmpl = TEMPLATES[type]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(tmpl["headers"])
    writer.writerow(tmpl["example"])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={type}_template.csv"},
    )


# ─── Analyse ─────────────────────────────────────────────────────────────────

@router.post("/analyse")
async def analyse_file(
    file: UploadFile = File(...),
    entity: str = Query(default="clients"),
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    content = await file.read()
    file_format = detect_file_format(file.filename or "upload.csv", content)

    # Determine target fields
    entity_map = {
        "clients": AGON_CLIENT_FIELDS,
        "memberships": AGON_MEMBERSHIP_FIELDS,
        "classes": AGON_CLASS_FIELDS,
    }
    target_fields = entity_map.get(entity, AGON_CLIENT_FIELDS)

    headers = parse_csv_headers(content)
    rows = parse_csv_rows(content)
    row_count = len(rows)

    mapping = llm_map_columns(headers, target_fields)
    unmapped = [col for col, val in mapping.items() if val is None]

    # Save file
    ensure_uploads_dir()
    filename = f"upload_{utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    saved_path = os.path.join(UPLOADS_DIR, filename)
    with open(saved_path, "wb") as f:
        f.write(content)

    job = MigrationJob(
        status="preview",
        file_path=saved_path,
        file_format=file_format,
        column_mapping=json.dumps(mapping),
        records_total=row_count,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "job_id": job.id,
        "file_format": file_format,
        "records_total": row_count,
        "column_mapping": mapping,
        "unmapped_columns": unmapped,
    }


# ─── Confirm import ───────────────────────────────────────────────────────────

@router.post("/confirm")
async def confirm_import(
    payload: ConfirmImportRequest,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    job = db.query(MigrationJob).filter(MigrationJob.id == payload.job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "MIGRATION_JOB_NOT_FOUND", "message": "Migration job not found"}},
        )
    if job.status != "preview":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "MIGRATION_INVALID_STATE", "message": f"Job is in state '{job.status}', expected 'preview'"}},
        )

    job.status = "importing"
    job.started_at = utcnow()
    job.column_mapping = json.dumps(payload.column_mapping)
    db.commit()

    # Read file and parse rows
    with open(job.file_path, "rb") as f:
        content = f.read()
    rows = parse_csv_rows(content)

    # Detect entity type from mapping values
    mapped_fields = set(v for v in payload.column_mapping.values() if v)
    if "email" in mapped_fields or "client_email" not in mapped_fields:
        imported, skipped, reasons = execute_client_import(db, rows, payload.column_mapping, job.id)
    else:
        imported, skipped, reasons = 0, len(rows), ["Unsupported entity type"]

    job.status = "completed"
    job.records_imported = imported
    job.records_skipped = skipped
    job.skipped_details = json.dumps(reasons)
    job.completed_at = utcnow()
    db.commit()
    db.refresh(job)

    return {
        "job_id": job.id,
        "status": job.status,
        "records_total": job.records_total,
        "records_imported": job.records_imported,
        "records_skipped": job.records_skipped,
        "completed_at": job.completed_at,
    }


# ─── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status(
    job_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    if job_id is not None:
        job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    else:
        job = db.query(MigrationJob).order_by(MigrationJob.id.desc()).first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "MIGRATION_JOB_NOT_FOUND", "message": "No migration job found"}},
        )

    return {
        "job_id": job.id,
        "status": job.status,
        "file_format": job.file_format,
        "records_total": job.records_total,
        "records_imported": job.records_imported,
        "records_skipped": job.records_skipped,
        "invitations_sent": job.invitations_sent,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "created_at": job.created_at,
    }


# ─── Summary ──────────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_summary(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    job = db.query(MigrationJob).filter(MigrationJob.status == "completed").order_by(MigrationJob.id.desc()).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "MIGRATION_JOB_NOT_FOUND", "message": "No completed migration job found"}},
        )

    skipped_details = []
    if job.skipped_details:
        try:
            skipped_details = json.loads(job.skipped_details)
        except Exception:
            pass

    return {
        "job_id": job.id,
        "status": job.status,
        "records_total": job.records_total,
        "records_imported": job.records_imported,
        "records_skipped": job.records_skipped,
        "skipped_details": skipped_details,
        "invitations_sent": job.invitations_sent,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    }


# ─── Send invitations ─────────────────────────────────────────────────────────

@router.post("/invitations/send")
async def send_invitations(
    payload: SendInvitationsRequest,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    job = db.query(MigrationJob).filter(MigrationJob.id == payload.job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "MIGRATION_JOB_NOT_FOUND", "message": "Migration job not found"}},
        )
    if job.status != "completed":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "MIGRATION_INVALID_STATE", "message": "Job must be in 'completed' state to send invitations"}},
        )

    if payload.client_ids:
        client_ids = payload.client_ids
    else:
        # Query clients created between job.started_at and job.completed_at
        if job.started_at and job.completed_at:
            clients = db.query(Client).filter(
                Client.created_at >= job.started_at,
                Client.created_at <= job.completed_at,
            ).all()
        else:
            clients = []
        client_ids = [c.id for c in clients]

    studio_settings = db.query(StudioSettings).filter(StudioSettings.location_id == 1).first()
    tokens = generate_invitation_tokens(db, client_ids, studio_settings)

    job.invitations_sent = len(tokens)
    db.commit()

    return tokens


# ─── Export invitations CSV ───────────────────────────────────────────────────

@router.get("/invitations/export")
async def export_invitations_csv(
    job_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    job = db.query(MigrationJob).filter(MigrationJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "MIGRATION_JOB_NOT_FOUND", "message": "Migration job not found"}},
        )

    # Get invitation tokens for clients imported in this job
    tokens = []
    if job.started_at and job.completed_at:
        clients = db.query(Client).filter(
            Client.created_at >= job.started_at,
            Client.created_at <= job.completed_at,
        ).all()
        client_ids = [c.id for c in clients]
        if client_ids:
            tokens = db.query(InvitationToken).filter(InvitationToken.client_id.in_(client_ids)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["client_id", "client_email", "invite_url", "expires_at"])

    studio_settings = db.query(StudioSettings).filter(StudioSettings.location_id == 1).first()
    tunnel_url = studio_settings.tunnel_url if studio_settings and studio_settings.tunnel_url else "http://localhost:8000"

    for inv in tokens:
        client_obj = db.query(Client).filter(Client.id == inv.client_id).first()
        email = client_obj.email if client_obj else ""
        invite_url = f"{tunnel_url}/invite/{inv.token}"
        writer.writerow([inv.client_id, email, invite_url, inv.expires_at])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=invitations_job_{job_id}.csv"},
    )
