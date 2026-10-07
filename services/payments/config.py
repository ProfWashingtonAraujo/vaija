from pydantic_settings import BaseSettings
from functools import lru_cache

# Valores de desenvolvimento: proibidos quando app_env == "production".
INSECURE_INTERNAL_API_KEY = "vaija-dev-internal-secret"
INSECURE_JWT_SECRET = "troque-esta-chave-em-producao"


class Settings(BaseSettings):
    database_url: str = "postgresql://vaija:secret@localhost:5432/vaija"
    mercado_pago_access_token: str = ""
    mercado_pago_public_key: str = ""
    mercado_pago_webhook_secret: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    backend_internal_url: str = "http://localhost:3001"
    internal_api_key: str = INSECURE_INTERNAL_API_KEY
    auth_jwt_secret: str = INSECURE_JWT_SECRET  # deve ser o mesmo segredo da API principal
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def assert_secure(self) -> None:
        """Em produção, recusa subir com segredos padrão ou ausentes."""
        if not self.is_production:
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
