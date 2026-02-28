from datetime import UTC, datetime

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _ensure_migrations_table(connection) -> None:
    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(64) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL
            )
            """
        )
    )


def _applied_versions(connection) -> set[str]:
    rows = connection.execute(text("SELECT version FROM schema_migrations")).fetchall()
    return {row[0] for row in rows}


def _record_version(connection, version: str) -> None:
    connection.execute(
        text("INSERT INTO schema_migrations (version, applied_at) VALUES (:version, :applied_at)"),
        {
            "version": version,
            "applied_at": _utcnow(),
        },
    )


def _migration_0001_initial_schema(connection) -> None:
    Base.metadata.create_all(bind=connection)


def _migration_0002_soft_delete_columns(connection) -> None:
    inspector = inspect(connection)

    if "projects" in inspector.get_table_names():
        project_columns = {column["name"] for column in inspector.get_columns("projects")}
        if "deleted_at" not in project_columns:
            connection.execute(text("ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP NULL"))

    if "tasks" in inspector.get_table_names():
        task_columns = {column["name"] for column in inspector.get_columns("tasks")}
        if "deleted_at" not in task_columns:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP NULL"))


MIGRATIONS = (
    ("0001_initial_schema", _migration_0001_initial_schema),
    ("0002_soft_delete_columns", _migration_0002_soft_delete_columns),
)


def run_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        _ensure_migrations_table(connection)
        applied_versions = _applied_versions(connection)

        for version, migration in MIGRATIONS:
            if version in applied_versions:
                continue

            migration(connection)
            _record_version(connection, version)
