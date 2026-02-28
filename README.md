# ADHD Focus Tracking System

Lightweight full-stack planner for people with ADHD who need a low-friction place to organize focus areas, track the next action, and maintain visible progress.

- React frontend with protected routes and an ADHD-oriented dashboard
- FastAPI backend with JWT authentication
- SQLAlchemy relational models for users, focus areas, and actions
- PostgreSQL-ready configuration with a SQLite fallback for local development
- Docker Compose setup for frontend, backend, and PostgreSQL
- Backend API tests for auth and CRUD workflows

## Project Structure

```text
.
|-- backend
|   |-- app
|   |   |-- auth.py
|   |   |-- config.py
|   |   |-- database.py
|   |   |-- dependencies.py
|   |   |-- main.py
|   |   |-- models.py
|   |   |-- schemas.py
|   |   `-- routers
|   |       |-- auth.py
|   |       |-- projects.py
|   |       `-- tasks.py
|   |-- tests
|   |   |-- conftest.py
|   |   `-- test_api.py
|   |-- .env.example
|   |-- Dockerfile
|   |-- requirements-dev.txt
|   `-- requirements.txt
|-- frontend
|   |-- src
|   |-- .env.example
|   |-- Dockerfile
|   |-- package.json
|   `-- vite.config.js
`-- docker-compose.yml
```

## Current Features

- Register, log in, and persist JWT-based sessions
- Create, list, and delete focus areas
- Create, edit, and delete actions inside a focus area
- Move actions across `todo`, `in_progress`, and `done`
- Filter actions by status
- Assign an action and display the assignee name/email in the UI
- Protected dashboard route that restores active sessions

## Local Backend Setup

1. Create and activate a Python virtual environment.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Copy `backend/.env.example` to `backend/.env` and adjust values if needed.
4. Start the API from the `backend` directory:

```bash
uvicorn app.main:app --reload
```

Environment notes:

- `DATABASE_URL` supports PostgreSQL and defaults to `sqlite:///./task_tracking.db` if omitted.
- `CORS_ORIGINS` should include your frontend dev URL.
- Tables are created automatically at startup for this MVP.

## Local Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Copy `frontend/.env.example` to `frontend/.env`.
3. Start the dev server:

```bash
npm run dev
```

By default the frontend expects the API at `http://127.0.0.1:8000`.

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- FastAPI on `localhost:8000`
- Vite frontend on `localhost:5173`

The Compose setup is optimized for easy local demos, not production hardening.

## Backend Tests

Install the dev dependencies:

```bash
pip install -r backend/requirements-dev.txt
```

Run the test suite from the `backend` directory:

```bash
pytest
```

The tests cover:

- Registration, duplicate registration protection, login, and `/auth/me`
- Focus area creation and deletion
- Action creation, editing, filtering, assignee hydration, and deletion

## API Overview

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /projects`
- `POST /projects`
- `DELETE /projects/{project_id}`
- `GET /tasks?project_id={id}&status={status}`
- `POST /tasks`
- `PATCH /tasks/{task_id}`
- `DELETE /tasks/{task_id}`
- `GET /health`

## Deployment Direction

- Frontend: Vercel, Netlify, or a static container
- Backend: Render, Fly.io, Railway, or AWS
- Database: Neon, Supabase, RDS, or any managed PostgreSQL provider
