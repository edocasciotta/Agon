import socket
from collections import namedtuple

import pytest
from app.routers import studio as studio_router

# Minimal stand-in for psutil's snicaddr namedtuple — _list_interface_ipv4_addrs
# only reads `.family` and `.address`.
_FakeAddr = namedtuple("_FakeAddr", ["family", "address"])


class _FakeUdpSocket:
    """Stand-in for the `with socket.socket(...) as s` UDP-connect trick."""

    def __init__(self, outbound_ip):
        self._outbound_ip = outbound_ip

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def connect(self, addr):
        if self._outbound_ip is None:
            raise OSError("network unreachable")

    def getsockname(self):
        return (self._outbound_ip, 0)


def _patch_udp_socket(monkeypatch, outbound_ip):
    monkeypatch.setattr(
        studio_router.socket,
        "socket",
        lambda *a, **kw: _FakeUdpSocket(outbound_ip),
    )


def _patch_interfaces(monkeypatch, interfaces: dict):
    """interfaces: {iface_name: [ipv4_str, ...]}"""

    def fake_net_if_addrs():
        return {
            name: [_FakeAddr(family=socket.AF_INET, address=ip) for ip in ips]
            for name, ips in interfaces.items()
        }

    monkeypatch.setattr(studio_router.psutil, "net_if_addrs", fake_net_if_addrs)


def test_get_lan_url_only_lan_interface(monkeypatch):
    """Only a normal LAN interface exists → returns its address."""
    _patch_udp_socket(monkeypatch, "192.168.1.50")
    _patch_interfaces(monkeypatch, {"en0": ["192.168.1.50"]})
    assert studio_router._get_lan_url() == "http://192.168.1.50:8000"


def test_get_lan_url_prefers_lan_over_vpn(monkeypatch):
    """VPN tunnel is the default route, but a real LAN interface also exists →
    prefer the LAN address, not the VPN tunnel's."""
    _patch_udp_socket(monkeypatch, "10.5.0.2")  # OS picks the VPN as outbound route
    _patch_interfaces(
        monkeypatch,
        {
            "utun3": ["10.5.0.2"],
            "en0": ["192.168.30.187"],
        },
    )
    assert studio_router._get_lan_url() == "http://192.168.30.187:8000"


def test_get_lan_url_detection_fails_falls_back_to_localhost(monkeypatch):
    """UDP-connect trick fails and no interfaces are discoverable → localhost."""
    _patch_udp_socket(monkeypatch, None)
    _patch_interfaces(monkeypatch, {})
    assert studio_router._get_lan_url() == "http://localhost:8000"


def test_get_lan_url_vpn_only_falls_back_to_vpn_address(monkeypatch):
    """VPN is the only interface available (no real LAN present) → still
    return the VPN address rather than dropping to localhost."""
    _patch_udp_socket(monkeypatch, "10.5.0.2")
    _patch_interfaces(monkeypatch, {"utun3": ["10.5.0.2"]})
    assert studio_router._get_lan_url() == "http://10.5.0.2:8000"


def test_get_lan_url_interface_enumeration_unavailable_trusts_udp_result(monkeypatch):
    """If psutil enumeration itself fails, we can't identify the owning
    interface — fall back to trusting the UDP-connect result as before."""
    _patch_udp_socket(monkeypatch, "192.168.1.50")

    def raising_net_if_addrs():
        raise OSError("enumeration not supported")

    monkeypatch.setattr(studio_router.psutil, "net_if_addrs", raising_net_if_addrs)
    assert studio_router._get_lan_url() == "http://192.168.1.50:8000"


@pytest.mark.parametrize(
    "name,expected",
    [
        ("utun3", True),
        ("tun0", True),
        ("tap0", True),
        ("ppp0", True),
        ("ipsec0", True),
        ("wg0", True),
        ("en0", False),
        ("Wi-Fi", False),
        ("eth0", False),
    ],
)
def test_is_tunnel_interface(name, expected):
    assert studio_router._is_tunnel_interface(name) is expected


def test_get_studio_not_configured(client, manager_auth_headers):
    """GET /studio with no row → 404"""
    response = client.get("/api/v1/studio", headers=manager_auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "NOT_FOUND"


def test_update_studio_creates_settings(client, manager_auth_headers):
    """PUT /studio as manager → 200, row created"""
    response = client.put(
        "/api/v1/studio",
        json={"studio_name": "Test Studio", "timezone": "Europe/Rome"},
        headers=manager_auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["studio_name"] == "Test Studio"
    assert data["timezone"] == "Europe/Rome"
    assert data["id"] == 1


def test_get_studio_after_update(client, manager_auth_headers):
    """GET /studio after PUT → 200, correct values"""
    client.put(
        "/api/v1/studio",
        json={"studio_name": "My Gym", "cancellation_hours": 4},
        headers=manager_auth_headers,
    )
    response = client.get("/api/v1/studio", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["studio_name"] == "My Gym"
    assert data["cancellation_hours"] == 4


def test_update_studio_requires_manager(client, db_session, manager_auth_headers):
    """PUT /studio as non-manager (instructor) → 403"""
    from app.auth import create_access_token, hash_password
    from app.models.user import User

    instructor_user = User(
        email="inst_studio@example.com",
        password_hash=hash_password("pass123"),
        full_name="Inst Studio",
        role="instructor",
        is_active=True,
    )
    db_session.add(instructor_user)
    db_session.commit()
    db_session.refresh(instructor_user)
    token = create_access_token({"sub": str(instructor_user.id), "role": "instructor"})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put(
        "/api/v1/studio",
        json={"studio_name": "Hacked"},
        headers=headers,
    )
    assert response.status_code == 403


def test_studio_status(client, manager_auth_headers):
    """GET /studio/status as manager → 200"""
    response = client.get("/api/v1/studio/status", headers=manager_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "tunnel_url" in data
    assert "tunnel_active" in data
    assert "last_backup_at" in data
