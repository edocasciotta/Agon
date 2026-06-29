"""
Email service — sends emails via SMTP using config from StudioSettings.
All functions are async. db.commit() is never called here.
"""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy.orm import Session
from app.models.studio_settings import StudioSettings


def _get_smtp_config(db: Session) -> StudioSettings:
    """Return StudioSettings row or raise ValueError if SMTP is not configured."""
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        raise ValueError("Studio settings not found")
    if not settings.email_smtp_host or not settings.email_from_address:
        raise ValueError("SMTP not configured: email_smtp_host and email_from_address are required")
    return settings


async def send_email(
    db: Session,
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: str,
) -> None:
    """Send one email via SMTP. Raises on failure."""
    cfg = _get_smtp_config(db)

    from_name = cfg.email_from_name or "Agon Studio"
    from_addr = cfg.email_from_address

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = f"{to_name} <{to_email}>"

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    smtp_port = cfg.email_smtp_port or 587
    use_tls = cfg.email_smtp_tls if cfg.email_smtp_tls is not None else True

    await aiosmtplib.send(
        msg,
        hostname=cfg.email_smtp_host,
        port=smtp_port,
        username=cfg.email_smtp_user or None,
        password=cfg.email_smtp_password or None,
        start_tls=use_tls,
    )


def _base_html(content: str, studio_name: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">{studio_name}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          {content}
        </td></tr>
        <tr><td style="background:#f4f4f4;padding:16px 32px;text-align:center;">
          <p style="margin:0;color:#888;font-size:12px;">© {studio_name}. Powered by Agon.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_invite_email(
    db: Session,
    to_email: str,
    to_name: str,
    invite_url: str,
    studio_name: str,
) -> None:
    """Send 'set your password' invitation email."""
    html_content = f"""
    <h2 style="color:#1a1a2e;margin-top:0;">Welcome to {studio_name}!</h2>
    <p style="color:#444;line-height:1.6;">Hi {to_name},</p>
    <p style="color:#444;line-height:1.6;">
      Your account has been created. Click the button below to set your password and access your account.
    </p>
    <p style="text-align:center;margin:32px 0;">
      <a href="{invite_url}"
         style="background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:700;display:inline-block;">
        Set Your Password
      </a>
    </p>
    <p style="color:#888;font-size:13px;">
      This link expires in 7 days. If you did not expect this email, you can ignore it.
    </p>
    <p style="color:#888;font-size:12px;word-break:break-all;">
      Or copy this link: {invite_url}
    </p>
    """
    html_body = _base_html(html_content, studio_name)
    text_body = (
        f"Welcome to {studio_name}!\n\n"
        f"Hi {to_name},\n\n"
        f"Your account has been created. Visit the link below to set your password:\n\n"
        f"{invite_url}\n\n"
        f"This link expires in 7 days."
    )
    await send_email(db, to_email, to_name, f"Welcome to {studio_name} — Set your password", html_body, text_body)


async def send_password_reset_email(
    db: Session,
    to_email: str,
    to_name: str,
    reset_url: str,
    studio_name: str,
) -> None:
    """Send password reset email."""
    html_content = f"""
    <h2 style="color:#1a1a2e;margin-top:0;">Reset your password</h2>
    <p style="color:#444;line-height:1.6;">Hi {to_name},</p>
    <p style="color:#444;line-height:1.6;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>
    <p style="text-align:center;margin:32px 0;">
      <a href="{reset_url}"
         style="background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:700;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="color:#888;font-size:13px;">
      This link expires in 2 hours. If you did not request a password reset, you can ignore this email.
    </p>
    <p style="color:#888;font-size:12px;word-break:break-all;">
      Or copy this link: {reset_url}
    </p>
    """
    html_body = _base_html(html_content, studio_name)
    text_body = (
        f"Reset your password for {studio_name}\n\n"
        f"Hi {to_name},\n\n"
        f"Visit the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in 2 hours. If you did not request this, ignore this email."
    )
    await send_email(db, to_email, to_name, f"Reset your password — {studio_name}", html_body, text_body)


async def send_test_email(db: Session, to_email: str, to_name: str, studio_name: str) -> None:
    """Send a test email to verify SMTP configuration."""
    html_content = f"""
    <h2 style="color:#1a1a2e;margin-top:0;">SMTP Test Email</h2>
    <p style="color:#444;line-height:1.6;">Hi {to_name},</p>
    <p style="color:#444;line-height:1.6;">
      This is a test email from <strong>{studio_name}</strong>. Your SMTP settings are working correctly.
    </p>
    <p style="color:#888;font-size:13px;">You can now send invitation and password reset emails to your clients.</p>
    """
    html_body = _base_html(html_content, studio_name)
    text_body = (
        f"SMTP Test Email from {studio_name}\n\n"
        f"Hi {to_name},\n\n"
        f"Your SMTP settings are working correctly."
    )
    await send_email(db, to_email, to_name, f"SMTP Test — {studio_name}", html_body, text_body)
