import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting in test environments so tests are not affected
_enabled = os.environ.get("AGON_ENV", "development") != "test"
limiter = Limiter(key_func=get_remote_address, enabled=_enabled)
