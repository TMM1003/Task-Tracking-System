def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_user(client, email="tester@example.com", name="Test User", password="safe-password-123"):
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": name,
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_auth_registration_and_login(client):
    registration = register_user(client)

    token = registration["token"]["access_token"]
    user = registration["user"]

    assert user["email"] == "tester@example.com"
    assert user["name"] == "Test User"
    assert token

    me_response = client.get("/auth/me", headers=auth_headers(token))
    assert me_response.status_code == 200
    assert me_response.json()["id"] == user["id"]

    duplicate_response = client.post(
        "/auth/register",
        json={
            "email": "tester@example.com",
            "name": "Test User",
            "password": "safe-password-123",
        },
    )
    assert duplicate_response.status_code == 409

    login_response = client.post(
        "/auth/login",
        json={
            "email": "tester@example.com",
            "password": "safe-password-123",
        },
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["id"] == user["id"]


def test_project_and_task_crud_flow(client):
    registration = register_user(client, email="workflow@example.com", name="Workflow User")
    token = registration["token"]["access_token"]
    user = registration["user"]
    headers = auth_headers(token)

    project_response = client.post(
        "/projects",
        headers=headers,
        json={
            "name": "Morning Reset",
            "description": "A small sequence for low-friction starts.",
        },
    )
    assert project_response.status_code == 201
    project = project_response.json()

    list_projects_response = client.get("/projects", headers=headers)
    assert list_projects_response.status_code == 200
    assert len(list_projects_response.json()) == 1

    task_response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Open the blinds",
            "description": "Let in light before checking messages.",
            "project_id": project["id"],
        },
    )
    assert task_response.status_code == 201
    task = task_response.json()
    assert task["assignee"] is None

    update_response = client.patch(
        f"/tasks/{task['id']}",
        headers=headers,
        json={
            "title": "Open the blinds and start tea",
            "description": "Light first, then a two-minute kitchen step.",
            "status": "in_progress",
            "assignee_id": user["id"],
        },
    )
    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert updated_task["title"] == "Open the blinds and start tea"
    assert updated_task["status"] == "in_progress"
    assert updated_task["assignee"]["id"] == user["id"]
    assert updated_task["assignee"]["name"] == user["name"]

    filtered_tasks_response = client.get(
        f"/tasks?project_id={project['id']}&status=in_progress",
        headers=headers,
    )
    assert filtered_tasks_response.status_code == 200
    filtered_tasks = filtered_tasks_response.json()
    assert len(filtered_tasks) == 1
    assert filtered_tasks[0]["id"] == task["id"]

    delete_task_response = client.delete(f"/tasks/{task['id']}", headers=headers)
    assert delete_task_response.status_code == 204

    empty_tasks_response = client.get(f"/tasks?project_id={project['id']}", headers=headers)
    assert empty_tasks_response.status_code == 200
    assert empty_tasks_response.json() == []

    delete_project_response = client.delete(f"/projects/{project['id']}", headers=headers)
    assert delete_project_response.status_code == 204

    final_projects_response = client.get("/projects", headers=headers)
    assert final_projects_response.status_code == 200
    assert final_projects_response.json() == []
