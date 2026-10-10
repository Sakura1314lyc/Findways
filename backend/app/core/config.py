from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "寻路 · 中国道路档案馆"
    app_env: Literal["development", "testing", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    database_url: str = "sqlite+aiosqlite:///./mingbian.db"
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    llm_provider: Literal["mock", "deepseek", "openai_compatible"] = "mock"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-chat"
    llm_timeout_seconds: float = 60.0
    llm_max_retries: int = 2
    seed_on_startup: bool = True
    log_level: str = "INFO"
    teacher_code: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_llm_provider(self) -> str:
        if self.llm_provider != "mock" and not self.llm_api_key:
            return "mock"
        return self.llm_provider


@lru_cache
def get_settings() -> Settings:
    return Settings()
