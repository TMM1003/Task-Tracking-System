const defaultApiUrl = (() => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }

  const { hostname, protocol } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }

  const apiProtocol = protocol === "https:" ? "https:" : "http:";
  return `${apiProtocol}//${hostname}:8000`;
})();

const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

async function request(path, options = {}) {
  const { token, body, headers, ...rest } = options;

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Unable to reach the API at ${API_URL}.`);
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Request failed.");
  }

  return data;
}

export const api = {
  register(payload) {
    return request("/auth/register", {
      method: "POST",
      body: payload,
    });
  },
  login(payload) {
    return request("/auth/login", {
      method: "POST",
      body: payload,
    });
  },
  me(token) {
    return request("/auth/me", { token });
  },
  listProjects(token) {
    return request("/projects", { token });
  },
  createProject(token, payload) {
    return request("/projects", {
      method: "POST",
      token,
      body: payload,
    });
  },
  deleteProject(token, projectId) {
    return request(`/projects/${projectId}`, {
      method: "DELETE",
      token,
    });
  },
  listTasks(token, params = {}) {
    const query = new URLSearchParams();

    if (params.projectId) {
      query.set("project_id", params.projectId);
    }

    if (params.status) {
      query.set("status", params.status);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/tasks${suffix}`, { token });
  },
  createTask(token, payload) {
    return request("/tasks", {
      method: "POST",
      token,
      body: payload,
    });
  },
  updateTask(token, taskId, payload) {
    return request(`/tasks/${taskId}`, {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  deleteTask(token, taskId) {
    return request(`/tasks/${taskId}`, {
      method: "DELETE",
      token,
    });
  },
};
