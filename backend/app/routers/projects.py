from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Project, Task, User
from ..schemas import ProjectCreate, ProjectRead


router = APIRouter(prefix="/projects", tags=["projects"])


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.scalars(
        select(Project)
        .where(Project.owner_id == current_user.id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
    ).all()
    return [ProjectRead.model_validate(project) for project in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_project = db.scalar(
        select(Project).where(
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
            func.lower(Project.name) == payload.name.lower(),
        )
    )
    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a project with that name.",
        )

    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(project)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a project with that name.",
        ) from exc

    db.refresh(project)
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    deleted_at = _utcnow()
    project.deleted_at = deleted_at

    active_tasks = db.scalars(
        select(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None))
    ).all()
    for task in active_tasks:
        task.deleted_at = deleted_at

    db.add(project)
    db.commit()


@router.post("/{project_id}/restore", response_model=ProjectRead)
def restore_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_not(None),
        )
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    active_duplicate = db.scalar(
        select(Project).where(
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
            Project.id != project.id,
            func.lower(Project.name) == project.name.lower(),
        )
    )
    if active_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A different active project already uses that name.",
        )

    deleted_marker = project.deleted_at
    project.deleted_at = None

    if deleted_marker is not None:
        project_tasks = db.scalars(
            select(Task).where(Task.project_id == project.id, Task.deleted_at == deleted_marker)
        ).all()
        for task in project_tasks:
            task.deleted_at = None

    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectRead.model_validate(project)
