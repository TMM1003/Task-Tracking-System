from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Project, User
from ..schemas import ProjectCreate, ProjectRead


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.scalars(
        select(Project).where(Project.owner_id == current_user.id).order_by(Project.created_at.desc())
    ).all()
    return [ProjectRead.model_validate(project) for project in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        name=payload.name.strip(),
        description=(payload.description.strip() or None) if payload.description is not None else None,
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
    project = db.scalar(select(Project).where(Project.id == project_id, Project.owner_id == current_user.id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    db.delete(project)
    db.commit()
