"""Tests for client/instructor profile photo upload and serving.

Covers: happy-path uploads (owner + manager-on-behalf-of), file validation
(type/size/content), path-traversal neutralization, and auth on the serving
route. IDOR/role-mismatch tests (wrong client_id, wrong instructor_id, wrong
role hitting the other entity's endpoint) live in test_authorization.py per
this project's convention.
"""

import io
import os

import pytest
from app.services.photo_service import PHOTOS_DIR, resolve_safe_photo_path

INSTRUCTOR_PAYLOAD = {
    "email": "photo-instructor@example.com",
    "password": "instructorpass123",
    "full_name": "Photo Instructor",
    "bio": "Yoga",
}


def _png_bytes(size=(4, 4)) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", size, color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes(size=(4, 4)) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", size, color=(0, 255, 0)).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def instructor_owner(client, manager_auth_headers):
    """Creates an instructor via the API and logs in as them.

    Returns dict with instructor_id and auth headers for that instructor.
    """
    resp = client.post("/api/v1/instructors", json=INSTRUCTOR_PAYLOAD, headers=manager_auth_headers)
    assert resp.status_code == 201, resp.text
    instructor_id = resp.json()["id"]

    login = client.post(
        "/api/v1/auth/login",
        json={"email": INSTRUCTOR_PAYLOAD["email"], "password": INSTRUCTOR_PAYLOAD["password"]},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return {"instructor_id": instructor_id, "headers": headers}


# ── Client photo upload: happy paths ──────────────────────────────────────


def test_client_can_upload_own_photo(client, client_auth_headers, registered_client, db_session):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    files = {"file": ("me.png", _png_bytes(), "image/png")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["photo_url"] is not None
    assert data["photo_url"].startswith("/api/v1/photos/")


def test_manager_can_upload_photo_on_behalf_of_client(
    client, manager_auth_headers, registered_client, db_session
):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    files = {"file": ("me.jpg", _jpeg_bytes(), "image/jpeg")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=manager_auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["photo_url"] is not None


def test_client_photo_replace_deletes_old_file(
    client, client_auth_headers, registered_client, db_session
):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()

    files1 = {"file": ("first.png", _png_bytes(), "image/png")}
    resp1 = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files1, headers=client_auth_headers
    )
    assert resp1.status_code == 200
    first_filename = resp1.json()["photo_url"].rsplit("/", 1)[-1]
    first_path = os.path.join(PHOTOS_DIR, first_filename)
    assert os.path.isfile(first_path)

    files2 = {"file": ("second.png", _png_bytes(), "image/png")}
    resp2 = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files2, headers=client_auth_headers
    )
    assert resp2.status_code == 200
    second_filename = resp2.json()["photo_url"].rsplit("/", 1)[-1]
    assert second_filename != first_filename
    assert not os.path.isfile(first_path)  # old file cleaned up
    assert os.path.isfile(os.path.join(PHOTOS_DIR, second_filename))


# ── Instructor photo upload: happy paths ──────────────────────────────────


def test_instructor_upload_rejects_content_type_mismatch(client, instructor_owner):
    """PNG bytes declared as webp (extension + content-type both say webp) must
    be rejected by the magic-byte check — a mismatch between claimed and
    actual format is not trusted."""
    files = {"file": ("me.webp", _png_bytes(), "image/webp")}
    resp = client.post(
        f"/api/v1/instructors/{instructor_owner['instructor_id']}/photo",
        files=files,
        headers=instructor_owner["headers"],
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "PHOTO_INVALID_TYPE"


def test_instructor_can_upload_own_photo_valid_png(client, instructor_owner):
    files = {"file": ("me.png", _png_bytes(), "image/png")}
    resp = client.post(
        f"/api/v1/instructors/{instructor_owner['instructor_id']}/photo",
        files=files,
        headers=instructor_owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["photo_url"] is not None


def test_manager_can_upload_photo_on_behalf_of_instructor(
    client, manager_auth_headers, instructor_owner
):
    files = {"file": ("me.jpg", _jpeg_bytes(), "image/jpeg")}
    resp = client.post(
        f"/api/v1/instructors/{instructor_owner['instructor_id']}/photo",
        files=files,
        headers=manager_auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["photo_url"] is not None


# ── Validation: type / size / content ─────────────────────────────────────


def test_upload_rejects_svg(client, client_auth_headers, registered_client, db_session):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    svg_content = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    files = {"file": ("evil.svg", svg_content, "image/svg+xml")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "PHOTO_INVALID_TYPE"


def test_upload_rejects_renamed_executable(
    client, client_auth_headers, registered_client, db_session
):
    """A non-image file renamed to .jpg with a spoofed content-type must be
    rejected by the magic-byte check, not just the extension/content-type."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    fake_content = b"MZ\x90\x00\x03\x00\x00\x00not-an-image-binary-payload"
    files = {"file": ("totally_a_photo.jpg", fake_content, "image/jpeg")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "PHOTO_INVALID_TYPE"


def test_upload_rejects_oversized_file(client, client_auth_headers, registered_client, db_session):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    oversized = os.urandom(6 * 1024 * 1024)  # 6MB > 5MB cap
    files = {"file": ("big.jpg", oversized, "image/jpeg")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "PHOTO_TOO_LARGE"


def test_upload_rejects_gif(client, client_auth_headers, registered_client, db_session):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    # Minimal valid GIF magic bytes — still rejected because .gif isn't allowed.
    gif_content = b"GIF89a" + b"\x00" * 20
    files = {"file": ("anim.gif", gif_content, "image/gif")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "PHOTO_INVALID_TYPE"


# ── Path traversal neutralization ──────────────────────────────────────────


def test_upload_neutralizes_path_traversal_filename(
    client, client_auth_headers, registered_client, db_session, tmp_path
):
    """A malicious filename must never escape PHOTOS_DIR — the stored file is
    always a server-generated name inside PHOTOS_DIR, regardless of what the
    client claims as the original filename."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    files = {"file": ("../../etc/passwd.png", _png_bytes(), "image/png")}
    resp = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert resp.status_code == 200, resp.text
    filename = resp.json()["photo_url"].rsplit("/", 1)[-1]
    assert ".." not in filename
    assert "/" not in filename
    saved_path = os.path.join(PHOTOS_DIR, filename)
    assert os.path.isfile(saved_path)
    # Confirm nothing was written outside PHOTOS_DIR.
    assert os.path.commonpath([os.path.abspath(saved_path), os.path.abspath(PHOTOS_DIR)]) == (
        os.path.abspath(PHOTOS_DIR)
    )


def test_resolve_safe_photo_path_rejects_traversal():
    """Direct unit test of the serving-route sanitizer against classic
    traversal payloads."""
    assert resolve_safe_photo_path("../../etc/passwd") is None or resolve_safe_photo_path(
        "../../etc/passwd"
    ).startswith(os.path.abspath(PHOTOS_DIR))
    # basename strips directory components entirely, so the result (if any)
    # must always resolve inside PHOTOS_DIR.
    result = resolve_safe_photo_path("....//....//etc/passwd")
    if result is not None:
        assert os.path.commonpath([result, os.path.abspath(PHOTOS_DIR)]) == os.path.abspath(
            PHOTOS_DIR
        )


# ── Serving route ──────────────────────────────────────────────────────────


def test_serving_route_requires_auth(client, client_auth_headers, registered_client, db_session):
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    files = {"file": ("me.png", _png_bytes(), "image/png")}
    upload = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert upload.status_code == 200
    filename = upload.json()["photo_url"].rsplit("/", 1)[-1]

    unauth_resp = client.get(f"/api/v1/photos/{filename}")
    assert unauth_resp.status_code == 401


def test_serving_route_works_with_valid_token_any_role(
    client, client_auth_headers, manager_auth_headers, registered_client, db_session
):
    """A manager (or any authenticated role) can fetch a client's photo — not
    owner-restricted, since profile photos are visible studio-wide."""
    from app.models.client import Client

    client_a = db_session.query(Client).filter_by(email=registered_client["email"]).first()
    files = {"file": ("me.png", _png_bytes(), "image/png")}
    upload = client.post(
        f"/api/v1/clients/{client_a.id}/photo", files=files, headers=client_auth_headers
    )
    assert upload.status_code == 200
    filename = upload.json()["photo_url"].rsplit("/", 1)[-1]

    resp = client.get(f"/api/v1/photos/{filename}", headers=manager_auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/")


def test_serving_route_404_for_unknown_filename(client, client_auth_headers):
    resp = client.get("/api/v1/photos/does_not_exist_1234.png", headers=client_auth_headers)
    assert resp.status_code == 404
