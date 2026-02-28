from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import engine
from .migrations import run_migrations
from .routers import auth, projects, tasks


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_migrations(engine)
    yield


app = FastAPI(
    title="ADHD Focus Tracking System API",
    description="Minimal API for managing focus areas, tasks, and progress with JWT authentication.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
