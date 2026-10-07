from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5434/vaija"
    backend_port: int = 3002  # porta separada enquanto o Go ainda roda na 3001
    auth_jwt_secret: str = "troque-esta-chave-em-producao"
    auth_refresh_days: int = 7
    auth_cookie_secure: bool = False
    cookie_same_site: str = "lax"
    frontend_origin: str = "http://localhost:5173"
    internal_api_key: str = "vaija-dev-internal-secret"
    n8n_order_status_webhook_url: str = ""
    seed_demo_data: bool = False
    bootstrap_admin_username: str = ""
    bootstrap_admin_password: str = ""
    app_env: str = "development"
    redis_url: str = "redis://localhost:6379"
    printer_ip: str = "192.168.1.100"
    printer_port: int = 9100
    printer_model: str = "epson"
    print_copies: int = 1

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
