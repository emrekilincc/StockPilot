from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND / ".env", extra="ignore")
    environment: Literal["development", "production", "test"] = "development"
    database_url: str = f"sqlite:///{(BACKEND / 'data' / 'stockpilot.db').as_posix()}"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173",
                                  "http://localhost:8000", "http://127.0.0.1:8000"]
    session_hours: int = 12
    upload_dir: Path = BACKEND / "uploads"
    frontend_dir: Path = BACKEND.parent / "frontend" / "dist"

    @model_validator(mode="after")
    def production_origins(self):
        if self.environment == "production" and any(
            not origin.startswith("https://") or "*" in origin for origin in self.allowed_origins
        ):
            raise ValueError("Production requires explicit HTTPS origins")
        if not self.database_url.startswith("sqlite:///"):
            raise ValueError("StockPilot only supports local SQLite")
        return self


settings = Settings()
