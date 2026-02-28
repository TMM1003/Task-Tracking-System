from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import TaskStatus


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSummary(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    token: Token
    user: UserRead


class ProjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: TaskStatus = TaskStatus.TODO


class TaskCreate(TaskBase):
    project_id: int
    assignee_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: TaskStatus | None = None
    assignee_id: int | None = None


class TaskRead(TaskBase):
    id: int
    project_id: int
    assignee_id: int | None
    assignee: UserSummary | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
