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


def create_project(client, headers, name="Morning Reset", description="A small sequence for low-friction starts."):
    response = client.post(
        "/projects",
        headers=headers,
        json={
            "name": name,
            "description": description,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_task(client, headers, project_id, title="Open the blinds", description="Let in light before checking messages."):
    response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": title,
            "description": description,
            "project_id": project_id,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_auth_registration_login_and_invalid_token(client):
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
            "email": "TESTER@example.com",
            "name": "Test User",
            "password": "safe-password-123",
        },
    )
    assert duplicate_response.status_code == 409

    login_response = client.post(
        "/auth/login",
        json={
            "email": "TESTER@example.com",
            "password": "safe-password-123",
        },
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["id"] == user["id"]

    unauthorized_response = client.get("/projects")
    assert unauthorized_response.status_code == 401

    invalid_token_response = client.get("/projects", headers=auth_headers("not-a-real-token"))
    assert invalid_token_response.status_code == 401


def test_validation_rejects_whitespace_only_values_and_duplicate_project_names(client):
    registration = register_user(client, email="validation@example.com", name="  Valid User  ")
    headers = auth_headers(registration["token"]["access_token"])

    invalid_register_response = client.post(
        "/auth/register",
        json={
            "email": "blank-name@example.com",
            "name": "   ",
            "password": "safe-password-123",
        },
    )
    assert invalid_register_response.status_code == 422

    project = create_project(client, headers, name="  Morning Reset  ")
    assert project["name"] == "Morning Reset"

    duplicate_project_response = client.post(
        "/projects",
        headers=headers,
        json={
            "name": "morning reset",
            "description": "Same name, different casing.",
        },
    )
    assert duplicate_project_response.status_code == 409

    invalid_task_response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "   ",
            "description": "Still blank after trimming.",
            "project_id": project["id"],
        },
    )
    assert invalid_task_response.status_code == 422

    task = create_task(client, headers, project["id"], title="  Start tea  ")
    assert task["title"] == "Start tea"

    invalid_update_response = client.patch(
        f"/tasks/{task['id']}",
        headers=headers,
        json={"title": "   "},
    )
    assert invalid_update_response.status_code == 422


def test_task_completion_history_soft_delete_and_restore_flow(client):
    registration = register_user(client, email="workflow@example.com", name="Workflow User")
    token = registration["token"]["access_token"]
    user = registration["user"]
    headers = auth_headers(token)

    project = create_project(client, headers)
    first_task = create_task(client, headers, project["id"], title="Open the blinds")
    second_task = create_task(client, headers, project["id"], title="Start the kettle")

    complete_response = client.patch(
        f"/tasks/{first_task['id']}",
        headers=headers,
        json={
            "status": "done",
            "assignee_id": user["id"],
        },
    )
    assert complete_response.status_code == 200
    completed_task = complete_response.json()
    assert completed_task["status"] == "done"
    assert completed_task["assignee"]["id"] == user["id"]

    done_filter_response = client.get(
        f"/tasks?project_id={project['id']}&status=done",
        headers=headers,
    )
    assert done_filter_response.status_code == 200
    assert [task["id"] for task in done_filter_response.json()] == [first_task["id"]]

    delete_second_task_response = client.delete(f"/tasks/{second_task['id']}", headers=headers)
    assert delete_second_task_response.status_code == 204

    visible_tasks_response = client.get(f"/tasks?project_id={project['id']}", headers=headers)
    assert visible_tasks_response.status_code == 200
    assert [task["id"] for task in visible_tasks_response.json()] == [first_task["id"]]

    delete_project_response = client.delete(f"/projects/{project['id']}", headers=headers)
    assert delete_project_response.status_code == 204

    empty_projects_response = client.get("/projects", headers=headers)
    assert empty_projects_response.status_code == 200
    assert empty_projects_response.json() == []

    restore_project_response = client.post(f"/projects/{project['id']}/restore", headers=headers)
    assert restore_project_response.status_code == 200
    assert restore_project_response.json()["id"] == project["id"]

    restored_tasks_response = client.get(f"/tasks?project_id={project['id']}", headers=headers)
    assert restored_tasks_response.status_code == 200
    assert [task["id"] for task in restored_tasks_response.json()] == [first_task["id"]]

    restore_second_task_response = client.post(f"/tasks/{second_task['id']}/restore", headers=headers)
    assert restore_second_task_response.status_code == 200
    assert restore_second_task_response.json()["id"] == second_task["id"]

    all_tasks_response = client.get(f"/tasks?project_id={project['id']}", headers=headers)
    assert all_tasks_response.status_code == 200
    assert {task["id"] for task in all_tasks_response.json()} == {first_task["id"], second_task["id"]}

    restore_active_task_response = client.post(f"/tasks/{first_task['id']}/restore", headers=headers)
    assert restore_active_task_response.status_code == 409


def test_cross_user_access_and_missing_resource_paths(client):
    owner = register_user(client, email="owner@example.com", name="Owner")
    other = register_user(client, email="other@example.com", name="Other")

    owner_headers = auth_headers(owner["token"]["access_token"])
    other_headers = auth_headers(other["token"]["access_token"])

    project = create_project(client, owner_headers, name="Owner Project")
    task = create_task(client, owner_headers, project["id"], title="Owner task")

    forbidden_project_delete = client.delete(f"/projects/{project['id']}", headers=other_headers)
    assert forbidden_project_delete.status_code == 404

    forbidden_task_restore = client.post(f"/tasks/{task['id']}/restore", headers=other_headers)
    assert forbidden_task_restore.status_code == 404

    missing_project_restore = client.post("/projects/999999/restore", headers=owner_headers)
    assert missing_project_restore.status_code == 404

    missing_task_delete = client.delete("/tasks/999999", headers=owner_headers)
    assert missing_task_delete.status_code == 404
