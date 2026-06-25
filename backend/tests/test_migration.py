"""
Phase 8 — Migration Assistant
10 tests covering templates, CSV analysis, import confirmation, status,
invitation generation, invitation CSV export, and invite token validation.
"""
import io
import uuid
from datetime import datetime, timedelta

import pytest


# ─── Template downloads ───────────────────────────────────────────────────────

def test_download_clients_template(client, manager_auth_headers):
    response = client.get("/api/v1/migration/templates/clients", headers=manager_auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    body = response.text
    assert "full_name" in body
    assert "email" in body


def test_download_memberships_template(client, manager_auth_headers):
    response = client.get("/api/v1/migration/templates/memberships", headers=manager_auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "client_email" in response.text


def test_download_classes_template(client, manager_auth_headers):
    response = client.get("/api/v1/migration/templates/classes", headers=manager_auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "class_name" in response.text


# ─── Analyse CSV ──────────────────────────────────────────────────────────────

def test_analyse_csv_clients(client, manager_auth_headers):
    csv_content = b"full_name,email,phone\nJohn Doe,john@example.com,+39123456\nJane Doe,jane@example.com,"
    files = {"file": ("clients.csv", io.BytesIO(csv_content), "text/csv")}
    response = client.post(
        "/api/v1/migration/analyse?entity=clients",
        files=files,
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["job_id"] > 0
    assert "column_mapping" in data
    assert data["records_total"] == 2
    # Exact headers should map correctly via heuristics
    assert data["column_mapping"]["email"] == "email"
    assert data["column_mapping"]["full_name"] == "full_name"


# ─── Confirm import ───────────────────────────────────────────────────────────

def test_confirm_import_clients(client, manager_auth_headers):
    # First analyse
    csv_content = b"full_name,email,phone\nAlice Import,alice@import.com,+390001\nBob Import,bob@import.com,"
    files = {"file": ("clients.csv", io.BytesIO(csv_content), "text/csv")}
    analyse_response = client.post(
        "/api/v1/migration/analyse?entity=clients",
        files=files,
        headers=manager_auth_headers,
    )
    assert analyse_response.status_code == 200
    job_id = analyse_response.json()["job_id"]
    mapping = analyse_response.json()["column_mapping"]

    # Then confirm
    confirm_response = client.post(
        "/api/v1/migration/confirm",
        json={"job_id": job_id, "column_mapping": mapping},
        headers=manager_auth_headers,
    )
    assert confirm_response.status_code == 200
    data = confirm_response.json()
    assert data["status"] == "completed"
    assert data["records_imported"] >= 1


# ─── Status ───────────────────────────────────────────────────────────────────

def test_migration_status(client, manager_auth_headers):
    # Create a job first
    csv_content = b"full_name,email\nStatus Test,statustest@example.com"
    files = {"file": ("clients.csv", io.BytesIO(csv_content), "text/csv")}
    analyse_response = client.post(
        "/api/v1/migration/analyse?entity=clients",
        files=files,
        headers=manager_auth_headers,
    )
    assert analyse_response.status_code == 200
    job_id = analyse_response.json()["job_id"]

    # Get status by job_id
    response = client.get(f"/api/v1/migration/status?job_id={job_id}", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == job_id
    assert data["status"] == "preview"

    # Get status without job_id (most recent)
    response2 = client.get("/api/v1/migration/status", headers=manager_auth_headers)
    assert response2.status_code == 200
    assert response2.json()["job_id"] == job_id


# ─── Invitations ─────────────────────────────────────────────────────────────

def test_generate_invitations(client, manager_auth_headers, db_session):
    # Analyse + confirm to get a completed job with imported clients
    csv_content = b"full_name,email\nInvite Alice,invitealice@example.com\nInvite Bob,invitebob@example.com"
    files = {"file": ("clients.csv", io.BytesIO(csv_content), "text/csv")}
    analyse_resp = client.post(
        "/api/v1/migration/analyse?entity=clients",
        files=files,
        headers=manager_auth_headers,
    )
    assert analyse_resp.status_code == 200
    job_id = analyse_resp.json()["job_id"]
    mapping = analyse_resp.json()["column_mapping"]

    confirm_resp = client.post(
        "/api/v1/migration/confirm",
        json={"job_id": job_id, "column_mapping": mapping},
        headers=manager_auth_headers,
    )
    assert confirm_resp.status_code == 200

    # Get imported client IDs from DB
    from app.models.client import Client
    clients = db_session.query(Client).filter(Client.email.in_(["invitealice@example.com", "invitebob@example.com"])).all()
    client_ids = [c.id for c in clients]
    assert len(client_ids) >= 1

    # Send invitations
    invite_resp = client.post(
        "/api/v1/migration/invitations/send",
        json={"job_id": job_id, "client_ids": client_ids},
        headers=manager_auth_headers,
    )
    assert invite_resp.status_code == 200
    tokens = invite_resp.json()
    assert isinstance(tokens, list)
    assert len(tokens) >= 1
    assert "invite_url" in tokens[0]
    assert "token" in tokens[0]


def test_export_invitations_csv(client, manager_auth_headers, db_session):
    # Analyse + confirm + send invitations
    csv_content = b"full_name,email\nExport Alice,exportalice@example.com"
    files = {"file": ("clients.csv", io.BytesIO(csv_content), "text/csv")}
    analyse_resp = client.post(
        "/api/v1/migration/analyse?entity=clients",
        files=files,
        headers=manager_auth_headers,
    )
    job_id = analyse_resp.json()["job_id"]
    mapping = analyse_resp.json()["column_mapping"]

    client.post(
        "/api/v1/migration/confirm",
        json={"job_id": job_id, "column_mapping": mapping},
        headers=manager_auth_headers,
    )

    from app.models.client import Client
    imported_client = db_session.query(Client).filter(Client.email == "exportalice@example.com").first()
    if imported_client:
        client.post(
            "/api/v1/migration/invitations/send",
            json={"job_id": job_id, "client_ids": [imported_client.id]},
            headers=manager_auth_headers,
        )

    export_resp = client.get(f"/api/v1/migration/invitations/export?job_id={job_id}", headers=manager_auth_headers)
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "client_id" in export_resp.text


# ─── Invite token endpoint ────────────────────────────────────────────────────

def test_invite_token_endpoint(client, db_session):
    """Valid invitation token returns client info."""
    from app.models.client import Client
    from app.models.invitation_token import InvitationToken
    from app.auth import hash_password

    # Create a client directly
    c = Client(
        email="tokentest@example.com",
        full_name="Token Test",
        password_hash=hash_password("pass12345"),
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    # Create a valid token
    token_str = str(uuid.uuid4())
    inv = InvitationToken(
        client_id=c.id,
        token=token_str,
        used=False,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    db_session.commit()

    response = client.get(f"/api/v1/auth/invite/{token_str}")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "tokentest@example.com"
    assert data["token_valid"] is True


def test_invite_token_expired(client, db_session):
    """Expired invitation token returns 409 INVITATION_EXPIRED."""
    from app.models.client import Client
    from app.models.invitation_token import InvitationToken
    from app.auth import hash_password

    # Create a client directly
    c = Client(
        email="expiredtoken@example.com",
        full_name="Expired Token",
        password_hash=hash_password("pass12345"),
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)

    # Create an expired token
    token_str = str(uuid.uuid4())
    inv = InvitationToken(
        client_id=c.id,
        token=token_str,
        used=False,
        expires_at=datetime.utcnow() - timedelta(days=1),  # already expired
    )
    db_session.add(inv)
    db_session.commit()

    response = client.get(f"/api/v1/auth/invite/{token_str}")
    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "INVITATION_EXPIRED"
