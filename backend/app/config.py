import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./task_tracking.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
default_cors_origins = "http://localhost:5173,http://127.0.0.1:5173"

CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", default_cors_origins).split(",") if origin.strip()]
