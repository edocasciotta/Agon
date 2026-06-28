import secrets
import os
import logging
from pydantic_settings import BaseSettings
from pydantic import model_validator
from dotenv import load_dotenv

_config_logger = logging.getLogger(__name__)

load_dotenv()

_DEFAULT_JWT_SECRET = "dev-jwt-secret-change-in-production"
_DEFAULT_SECRET_KEY = "dev-secret-change-in-production"


class Settings(BaseSettings):
    AGON_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./agon.db"
    AGON_SECRET_KEY: str = _DEFAULT_SECRET_KEY
    AGON_JWT_SECRET: str = _DEFAULT_JWT_SECRET
    LOG_LEVEL: str = "INFO"
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "groq/llama-3.3-70b-versatile"
    LLM_API_KEY: str = ""
    STUDIO_TIMEZONE: str = "Europe/Rome"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = "whsec_test"
    EXPO_ACCESS_TOKEN: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @model_validator(mode="after")
    def _ensure_secrets(self) -> "Settings":
        """Auto-generate cryptographically strong secrets on first run.

        If either secret is still the insecure default (e.g. fresh install
        without a .env file), generate a random value and append it to .env
        so it persists across restarts without manual intervention.
        """
        lines: list[str] = []
        if self.AGON_JWT_SECRET == _DEFAULT_JWT_SECRET:
            self.AGON_JWT_SECRET = secrets.token_hex(32)
            lines.append(f"AGON_JWT_SECRET={self.AGON_JWT_SECRET}")
        if self.AGON_SECRET_KEY == _DEFAULT_SECRET_KEY:
            self.AGON_SECRET_KEY = secrets.token_hex(32)
            lines.append(f"AGON_SECRET_KEY={self.AGON_SECRET_KEY}")
        if lines:
            env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
            env_path = os.path.abspath(env_path)
            with open(env_path, "a", encoding="utf-8") as f:
                f.write("\n" + "\n".join(lines) + "\n")
        if self.STRIPE_WEBHOOK_SECRET == "whsec_test":
            _config_logger.warning(
                "STRIPE_WEBHOOK_SECRET is set to the insecure default 'whsec_test'. "
                "Stripe webhooks will be rejected until a real secret is configured "
                "from the Stripe dashboard (Settings > Webhooks)."
            )
        return self


settings = Settings()
