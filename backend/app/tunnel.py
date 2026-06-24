from abc import ABC, abstractmethod
from typing import Optional


class TunnelProvider(ABC):
    @abstractmethod
    async def start(self) -> str: ...

    @abstractmethod
    async def stop(self) -> None: ...

    @abstractmethod
    async def get_url(self) -> Optional[str]: ...

    @abstractmethod
    async def is_running(self) -> bool: ...


class CloudflareTunnelProvider(TunnelProvider):
    """Stub implementation — full implementation in Phase 6."""

    async def start(self) -> str:
        return "http://localhost:8000"

    async def stop(self) -> None:
        pass

    async def get_url(self) -> Optional[str]:
        return "http://localhost:8000"

    async def is_running(self) -> bool:
        return True
