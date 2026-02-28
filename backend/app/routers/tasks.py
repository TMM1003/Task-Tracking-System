from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Project, Task, TaskStatus, User
from ..schemas import TaskCreate, TaskRead, TaskUpdate


router = APIRouter(prefix="/tasks", tags=["tasks"])


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_owned_project(project_id: int, user_id: int, db: Session) -> Project:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def _get_owned_task(task_id: int, user_id: int, db: Session, *, include_deleted: bool = False) -> Task:
    filters = [Task.id == task_id, Project.owner_id == user_id, Project.deleted_at.is_(None)]
    if not include_deleted:
        filters.append(Task.deleted_at.is_(None))

    task = db.scalar(
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(*filters)
        .options(joinedload(Task.project), joinedload(Task.assignee))
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return task


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int | None = Query(default=None),
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
            Task.deleted_at.is_(None),
        )
        .options(joinedload(Task.assignee))
        .order_by(Task.updated_at.desc())
    )

    if project_id is not None:
        query = query.where(Task.project_id == project_id)

    if status_filter is not None:
        query = query.where(Task.status == status_filter)

    tasks = db.scalars(query).all()
    return [TaskRead.model_validate(task) for task in tasks]


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_project(payload.project_id, current_user.id, db)

    assignee_id = payload.assignee_id
    if assignee_id is not None and assignee_id != current_user.id:
        assignee = db.get(User, assignee_id)
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found.")

    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        project_id=payload.project_id,
        assignee_id=assignee_id,
    )
    db.add(task)
    db.commit()
    return TaskRead.model_validate(_get_owned_task(task.id, current_user.id, db))


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_owned_task(task_id, current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        task.title = update_data["title"]

    if "description" in update_data:
        task.description = update_data["description"]

    if "status" in update_data and update_data["status"] is not None:
        task.status = update_data["status"]

    if "assignee_id" in update_data:
        assignee_id = update_data["assignee_id"]
        if assignee_id is not None and assignee_id != current_user.id:
            assignee = db.get(User, assignee_id)
            if not assignee:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found.")
        task.assignee_id = assignee_id

    db.add(task)
    db.commit()
    return TaskRead.model_validate(_get_owned_task(task.id, current_user.id, db))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_owned_task(task_id, current_user.id, db)
    task.deleted_at = _utcnow()
    db.add(task)
    db.commit()


@router.post("/{task_id}/restore", response_model=TaskRead)
def restore_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_owned_task(task_id, current_user.id, db, include_deleted=True)
    if task.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is already active.")

    task.deleted_at = None
    db.add(task)
    db.commit()
    return TaskRead.model_validate(_get_owned_task(task.id, current_user.id, db))
