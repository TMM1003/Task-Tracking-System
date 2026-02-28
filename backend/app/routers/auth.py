from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import AuthResponse, Token, UserCreate, UserLogin, UserRead


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = Token(access_token=create_access_token(str(user.id)))
    return AuthResponse(token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = Token(access_token=create_access_token(str(user.id)))
    return AuthResponse(token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)

