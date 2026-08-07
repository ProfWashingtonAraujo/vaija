from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://vaija:secret@localhost:5432/vaija"
    mercado_pago_access_token: str = ""
    mercado_pago_public_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    backend_internal_url: str = "http://localhost:3001"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
