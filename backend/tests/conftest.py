from contextlib import asynccontextmanager
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path):
    test_db_path = tmp_path / "test_task_tracking.db"
    engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    @asynccontextmanager
    async def no_op_lifespan(_):
        yield

    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = no_op_lifespan
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    app.router.lifespan_context = original_lifespan
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
