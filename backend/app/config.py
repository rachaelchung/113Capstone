from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Full SQLAlchemy URL. Leave unset to use SQLite at Flask's instance_path/tracker.db
    database_url: str | None = None
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = (
        "http://127.0.0.1:8080,http://localhost:8080,"
        "http://127.0.0.1:5500,http://localhost:5500"
    )
    # Sessions (OAuth state) + JWT signing. Override in production (32+ random bytes recommended).
    secret_key: str = "dev-only-change-me-in-dotenv-32chars!!"
    # After Google login, browser is sent here with #tracker_auth=<jwt>
    frontend_origin: str = "http://127.0.0.1:5500"
    google_client_id: str = ""
    google_client_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


def cors_origin_list() -> list[str]:
    s = get_settings()
    out = [o.strip() for o in s.cors_origins.split(",") if o.strip()]
    fo = (s.frontend_origin or "").strip().rstrip("/")
    if fo and fo not in out:
        out.append(fo)
    return out
