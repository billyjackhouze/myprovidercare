from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NationalCM"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    APP_PORT: int = 8080
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://nationalcm:nationalcm@localhost:5432/nationalcm"
    DATABASE_SYNC_URL: str = "postgresql+psycopg2://nationalcm:nationalcm@localhost:5432/nationalcm"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = "nationalcm-files"

    # Anthropic (Claude AI)
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://nationalcm.bjesoftware.com",
    ]

    # Office Ally
    OA_FHIR_BASE_URL: str = "https://fhirpt.officeally.com/officeally/officeally/r4"
    OA_CLIENT_ID: Optional[str] = None
    OA_CLIENT_SECRET: Optional[str] = None

    # ADP
    ADP_CLIENT_ID: Optional[str] = None
    ADP_CLIENT_SECRET: Optional[str] = None
    ADP_BASE_URL: str = "https://api.adp.com"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
