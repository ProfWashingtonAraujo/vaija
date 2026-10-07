from pydantic_settings import BaseSettings
from functools import lru_cache


INSECURE_JWT_SECRET = "troque-esta-chave-em-producao"
INSECURE_INTERNAL_API_KEY = "vaija-dev-internal-secret"


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5434/vaija"
    backend_port: int = 3002  # porta separada enquanto o Go ainda roda na 3001
    auth_jwt_secret: str = INSECURE_JWT_SECRET
    auth_refresh_days: int = 7
    auth_cookie_secure: bool = False
    cookie_same_site: str = "lax"
    frontend_origin: str = "http://localhost:5173"
    internal_api_key: str = INSECURE_INTERNAL_API_KEY
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

    def assert_secure(self) -> None:
        """Em produção, recusa subir com segredos padrão ou curtos."""
        if self.app_env.lower() != "production":
            return
        problems = []
        if self.internal_api_key in ("", INSECURE_INTERNAL_API_KEY) or len(self.internal_api_key) < 32:
            problems.append("INTERNAL_API_KEY")
        if self.auth_jwt_secret in ("", INSECURE_JWT_SECRET) or len(self.auth_jwt_secret) < 32:
            problems.append("AUTH_JWT_SECRET")
        if problems:
            raise RuntimeError(
                f"Segredos inseguros em produção: {', '.join(problems)} (defina valores aleatórios com 32+ caracteres)"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
