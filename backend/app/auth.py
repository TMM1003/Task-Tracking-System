from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY

ALGORITHM = "HS256"

# Use PBKDF2 for new hashes so long passwords do not hit bcrypt's 72-byte limit.
# Keep bcrypt as a legacy verifier in case any local users were already created.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expires_delta = timedelta(minutes=expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES)
    expire_at = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    subject = payload.get("sub")
    if not subject:
        return None

    return subject
