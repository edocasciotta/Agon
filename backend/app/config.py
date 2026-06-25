from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    AGON_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./agon.db"
    AGON_SECRET_KEY: str = "dev-secret-change-in-production"
    AGON_JWT_SECRET: str = "dev-jwt-secret-change-in-production"
    LOG_LEVEL: str = "INFO"
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "llama3.2"
    LLM_BASE_URL: str = "http://localhost:11434"
    LLM_API_KEY: str = ""
    STUDIO_TIMEZONE: str = "Europe/Rome"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = "whsec_test"
    EXPO_ACCESS_TOKEN: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
