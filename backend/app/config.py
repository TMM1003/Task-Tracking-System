import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./task_tracking.db")
raw_secret_key = os.getenv("SECRET_KEY", "").strip()

if not raw_secret_key:
    if APP_ENV in {"development", "dev", "local", "test", "testing"}:
        raw_secret_key = "dev-secret-change-me"
    else:
        raise RuntimeError("SECRET_KEY must be set outside local development.")

if raw_secret_key == "dev-secret-change-me" and APP_ENV not in {"development", "dev", "local", "test", "testing"}:
    raise RuntimeError("Set a unique SECRET_KEY before running outside local development.")

SECRET_KEY = raw_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
default_cors_origins = "http://localhost:5173,http://127.0.0.1:5173"

CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", default_cors_origins).split(",") if origin.strip()]
