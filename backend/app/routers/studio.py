import ipaddress
import os
import socket
import tempfile

import psutil
from app.auth import get_current_user, require_manager
from app.config import settings as app_settings
from app.database import get_db
from app.models.studio_settings import StudioSettings
from app.schemas.studio import StudioBrandingResponse, StudioSettingsResponse, StudioSettingsUpdate
from fastapi import APIRouter, Depends, HTTPException
from litellm import completion
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/studio", tags=["studio"])

# Interface name prefixes commonly used by VPN/tunnel adapters. macOS VPN clients
# typically create utun*; Linux/cross-platform clients use tun*/tap*/wg*; PPP-based
# and IPsec clients use ppp*/ipsec* on both. This is a naming-convention heuristic,
# not a guarantee — see the docstring on `_get_lan_url` for its limitations.
_TUNNEL_INTERFACE_PREFIXES = ("utun", "ppp", "tun", "tap", "ipsec", "wg")


def _is_tunnel_interface(name: str) -> bool:
    """Best-effort check: does this interface name look like a VPN/tunnel adapter?

    False negatives are expected: some VPN clients (notably some corporate/
    enterprise VPN software) name their virtual adapter something that doesn't
    match any of these prefixes, in which case we can't distinguish it from a
    real LAN adapter and may still return its address. False positives are
    theoretically possible but very unlikely (a physical adapter coincidentally
    named e.g. "tunXYZ").
    """
    return name.lower().startswith(_TUNNEL_INTERFACE_PREFIXES)


def _is_usable_lan_ip(ip: str) -> bool:
    """Exclude loopback/link-local/multicast addresses from LAN candidates."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (addr.is_loopback or addr.is_link_local or addr.is_multicast)


def _list_interface_ipv4_addrs() -> dict[str, list[str]]:
    """Map interface name -> list of IPv4 addresses on this host.

    Uses `psutil.net_if_addrs()`, which is the standard cross-platform (macOS/
    Linux/Windows) way to enumerate network interfaces *by name* in Python —
    something the stdlib `socket` module alone doesn't provide a portable way
    to do (interface-address enumeration is OS-specific: ioctl on POSIX,
    GetAdaptersAddresses on Windows). Interface *name* is what lets us tell a
    genuine LAN adapter (en0, Wi-Fi, eth0, ...) apart from a VPN/tunnel adapter
    (utun3, tun0, ppp0, ...) that happens to report a private-looking IPv4
    address — IP range alone can't do this, since VPNs routinely hand out
    ordinary RFC1918 addresses too.

    Returns {} (rather than raising) if enumeration fails for any reason, so
    callers always have a safe, empty-collection fallback path.
    """
    result: dict[str, list[str]] = {}
    try:
        for iface_name, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    result.setdefault(iface_name, []).append(addr.address)
    except Exception:
        return {}
    return result


def _best_lan_ip_from_interfaces() -> str | None:
    """Scan all non-tunnel interfaces for the best candidate LAN IPv4 address.

    Prefers a private (RFC1918) address; falls back to any other usable
    (non-loopback/link-local/multicast) address on a non-tunnel interface if no
    private one is found. Returns None if nothing suitable is found.
    """
    private_candidate: str | None = None
    any_candidate: str | None = None
    for iface_name, ips in _list_interface_ipv4_addrs().items():
        if _is_tunnel_interface(iface_name):
            continue
        for ip in ips:
            if not _is_usable_lan_ip(ip):
                continue
            if any_candidate is None:
                any_candidate = ip
            if private_candidate is None and ipaddress.ip_address(ip).is_private:
                private_candidate = ip
    return private_candidate or any_candidate


def _get_lan_url() -> str:
    """Return the backend's LAN URL, preferring a genuine LAN interface over a VPN tunnel.

    Two-step best-effort approach:

    1. Ask the OS which local address it would use to route to the public
       internet (the UDP "connect" trick — no packet is actually sent, this
       just consults the routing table). This is usually correct, but when a
       VPN is active and its tunnel is the default route, the OS answers with
       the VPN's internal tunnel address (e.g. `10.5.0.2` on a `utun*`
       interface on macOS) instead of the real WiFi/Ethernet LAN address a
       phone on the same network can actually reach.
    2. Cross-check that address against the host's network interfaces (by
       name, via `_list_interface_ipv4_addrs`). If the address belongs to an
       interface whose name matches common VPN/tunnel naming conventions
       (`_is_tunnel_interface`), don't trust it — instead scan the remaining
       non-tunnel interfaces for a plausible LAN address
       (`_best_lan_ip_from_interfaces`) and prefer that.

    This is inherently a "best effort" heuristic, not a guarantee: interface
    naming conventions vary across OSes and VPN clients, and a VPN whose
    virtual adapter doesn't match any of `_TUNNEL_INTERFACE_PREFIXES` (e.g.
    some corporate VPN clients) won't be caught by step 2 — its address could
    still leak through unfiltered in that case. There is no way to distinguish
    a VPN address from a LAN address by IP range alone, since both routinely
    use ordinary RFC1918 private ranges; interface identity is the only signal
    available short of OS-specific default-route inspection.

    Falls back to `"http://localhost:8000"` if neither step yields anything
    (e.g. no network connectivity at all) — this preserves the original
    behavior for that case.
    """
    outbound_ip: str | None = None
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            outbound_ip = s.getsockname()[0]
    except Exception:
        outbound_ip = None

    if outbound_ip is not None:
        interfaces = _list_interface_ipv4_addrs()
        owning_iface = next((name for name, ips in interfaces.items() if outbound_ip in ips), None)
        if owning_iface is None or not _is_tunnel_interface(owning_iface):
            # Either interface enumeration is unavailable (trust the OS's
            # answer as-is, same as the original behavior) or the outbound
            # route genuinely goes through a non-tunnel interface.
            return f"http://{outbound_ip}:8000"

        # The outbound route goes through what looks like a VPN/tunnel
        # interface — prefer a real LAN address if one is available.
        lan_ip = _best_lan_ip_from_interfaces()
        if lan_ip is not None:
            return f"http://{lan_ip}:8000"
        # No non-tunnel candidate found; fall back to the (possibly VPN)
        # address rather than dropping to localhost, matching prior behavior.
        return f"http://{outbound_ip}:8000"

    # UDP-connect trick failed outright (e.g. no route to the internet at
    # all) — see if a LAN address is discoverable directly from interfaces.
    lan_ip = _best_lan_ip_from_interfaces()
    if lan_ip is not None:
        return f"http://{lan_ip}:8000"

    return "http://localhost:8000"


@router.get("/branding", response_model=StudioBrandingResponse)
def get_studio_branding(db: Session = Depends(get_db)):
    settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if not settings:
        return StudioBrandingResponse(studio_name="Agon")
    return StudioBrandingResponse(
        studio_name=settings.studio_name or "Agon",
        primary_color=settings.primary_color,
        secondary_color=settings.secondary_color,
    )


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
    return StudioSettingsResponse.model_validate({**settings.__dict__, "lan_url": _get_lan_url()})


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

    # Atomic write: write to temp file then rename
    dir_path = os.path.dirname(env_path) or "."
    with tempfile.NamedTemporaryFile(mode="w", dir=dir_path, delete=False, suffix=".tmp") as tmp:
        tmp.writelines(new_lines)
        tmp_path = tmp.name
    os.replace(tmp_path, env_path)


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
