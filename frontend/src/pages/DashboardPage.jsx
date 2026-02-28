import { useEffect, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const initialProjectForm = {
  name: "",
  description: "",
};

const initialTaskForm = {
  title: "",
  description: "",
};

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "todo", label: "Needs attention" },
  { value: "in_progress", label: "In motion" },
  { value: "done", label: "Done" },
];

const taskStatusActions = [
  { value: "todo", label: "Reset" },
  { value: "in_progress", label: "Start" },
  { value: "done", label: "Done" },
];

function getAssigneeLabel(task, user) {
  if (!task.assignee) {
    return "No accountability buddy assigned.";
  }

  if (task.assignee.id === user?.id) {
    return `Assigned to you (${task.assignee.email})`;
  }

  return `Assigned to ${task.assignee.name} (${task.assignee.email})`;
}

export default function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [error, setError] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const selectedProject =
    projects.find((project) => String(project.id) === String(selectedProjectId)) || null;

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const loadedProjects = await api.listProjects(token);
        if (!isMounted) {
          return;
        }

        setProjects(loadedProjects);

        if (loadedProjects.length > 0) {
          setSelectedProjectId((current) => current || String(loadedProjects[0].id));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    setEditingTaskId(null);
    setTaskForm(initialTaskForm);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    let isMounted = true;

    api
      .listTasks(token, {
        projectId: selectedProjectId,
        status: statusFilter,
      })
      .then((loadedTasks) => {
        if (!isMounted) {
          return;
        }

        setTasks(loadedTasks);

        if (editingTaskId && !loadedTasks.some((task) => task.id === editingTaskId)) {
          setEditingTaskId(null);
          setTaskForm(initialTaskForm);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError.message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [editingTaskId, selectedProjectId, statusFilter, token]);

  const resetTaskComposer = () => {
    setEditingTaskId(null);
    setTaskForm(initialTaskForm);
  };

  const refreshTasks = async (projectId = selectedProjectId, filter = statusFilter) => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    const loadedTasks = await api.listTasks(token, {
      projectId,
      status: filter,
    });
    setTasks(loadedTasks);

    if (editingTaskId && !loadedTasks.some((task) => task.id === editingTaskId)) {
      resetTaskComposer();
    }
  };

  const handleProjectField = (event) => {
    const { name, value } = event.target;
    setProjectForm((current) => ({ ...current, [name]: value }));
  };

  const handleTaskField = (event) => {
    const { name, value } = event.target;
    setTaskForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setIsBusy(true);
    setError("");

    try {
      const project = await api.createProject(token, projectForm);
      const nextProjects = [project, ...projects];
      setProjects(nextProjects);
      setProjectForm(initialProjectForm);
      setSelectedProjectId(String(project.id));
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    setIsBusy(true);
    setError("");

    try {
      await api.deleteProject(token, projectId);
      const nextProjects = projects.filter((project) => project.id !== projectId);
      setProjects(nextProjects);
      const nextSelectedProject = nextProjects[0] ? String(nextProjects[0].id) : "";
      setSelectedProjectId(nextSelectedProject);
      setTasks([]);
      resetTaskComposer();
    } catch (deletionError) {
      setError(deletionError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitTask = async (event) => {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Create a focus area before adding actions.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      if (editingTaskId) {
        await api.updateTask(token, editingTaskId, taskForm);
      } else {
        await api.createTask(token, {
          ...taskForm,
          project_id: Number(selectedProjectId),
        });
      }

      resetTaskComposer();
      await refreshTasks();
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setIsBusy(true);
    setError("");

    try {
      await api.deleteTask(token, taskId);

      if (editingTaskId === taskId) {
        resetTaskComposer();
      }

      await refreshTasks();
    } catch (deletionError) {
      setError(deletionError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStatusUpdate = async (taskId, nextStatus) => {
    setIsBusy(true);
    setError("");

    try {
      await api.updateTask(token, taskId, { status: nextStatus });
      await refreshTasks();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAssignToMe = async (taskId) => {
    setIsBusy(true);
    setError("");

    try {
      await api.updateTask(token, taskId, { assignee_id: user.id });
      await refreshTasks();
    } catch (assignmentError) {
      setError(assignmentError.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
    });
  };

  if (isBootstrapping) {
    return (
      <div className="page-shell centered-shell">
        <div className="glass-panel loading-card">Loading focus planner...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="top-bar">
        <div>
          <span className="eyebrow">ADHD Focus Space</span>
          <h1>ADHD Focus Tracking System</h1>
          <p className="muted-copy">
            Focus areas, next actions, status filters, and lightweight accountability in one view.
          </p>
        </div>
        <div className="user-actions">
          <div className="user-chip">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="secondary-button" onClick={signOut} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="dashboard-grid">
        <section className="glass-panel panel-stack">
          <div className="section-heading">
            <span className="eyebrow">Focus Areas</span>
            <h2>Build your anchors</h2>
          </div>

          <form className="stacked-form compact-form" onSubmit={handleCreateProject}>
            <label>
              Focus area name
              <input
                name="name"
                onChange={handleProjectField}
                placeholder="Morning reset"
                required
                value={projectForm.name}
              />
            </label>
            <label>
              What does this support?
              <textarea
                name="description"
                onChange={handleProjectField}
                placeholder="Home, school, paperwork, health, or another part of life."
                rows={3}
                value={projectForm.description}
              />
            </label>
            <button className="primary-button" disabled={isBusy} type="submit">
              Create Focus Area
            </button>
          </form>

          <div className="project-list">
            {projects.length === 0 ? (
              <p className="empty-state">No focus areas yet. Create one so today has a place to start.</p>
            ) : (
              projects.map((project) => (
                <div
                  className={selectedProject?.id === project.id ? "project-card active" : "project-card"}
                  key={project.id}
                >
                  <div className="project-card-header">
                    <button
                      className="project-select"
                      onClick={() => setSelectedProjectId(String(project.id))}
                      type="button"
                    >
                      <strong>{project.name}</strong>
                      <p>{project.description || "No note added yet."}</p>
                    </button>
                    <button
                      className="danger-link"
                      disabled={isBusy}
                      onClick={() => handleDeleteProject(project.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass-panel panel-stack">
          <div className="task-header">
            <div className="section-heading">
              <span className="eyebrow">Next Actions</span>
              <h2>{selectedProject ? selectedProject.name : "Choose a focus area"}</h2>
              <p className="muted-copy supporting-copy">
                {selectedProject?.description || "Pick a focus area, then capture the smallest next step."}
              </p>
            </div>

            <label className="filter-control">
              Status filter
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form className="stacked-form compact-form" onSubmit={handleSubmitTask}>
            <label>
              Next action
              <input
                name="title"
                onChange={handleTaskField}
                placeholder="Start laundry for 10 minutes"
                required
                value={taskForm.title}
              />
            </label>
            <label>
              Helpful context
              <textarea
                name="description"
                onChange={handleTaskField}
                placeholder="Keep it tiny, visible, and specific."
                rows={3}
                value={taskForm.description}
              />
            </label>
            <div className="form-action-row">
              <button className="primary-button" disabled={isBusy || !selectedProjectId} type="submit">
                {editingTaskId ? "Save Action" : "Add Action"}
              </button>
              {editingTaskId ? (
                <button className="link-button" onClick={resetTaskComposer} type="button">
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="task-list">
            {tasks.length === 0 ? (
              <p className="empty-state">No actions match this view yet.</p>
            ) : (
              tasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-header">
                    <div className="task-copy">
                      <div className="task-meta">
                        <span className={`status-pill status-${task.status}`}>{task.status.replace("_", " ")}</span>
                        <span className="mono-copy">#{task.id}</span>
                      </div>
                      <h3>{task.title}</h3>
                      <p>{task.description || "No extra context added."}</p>
                      <span className="muted-copy">{getAssigneeLabel(task, user)}</span>
                    </div>
                    <div className="task-card-tools">
                      <button className="ghost-button" onClick={() => handleEditTask(task)} type="button">
                        Edit
                      </button>
                      <button
                        className="danger-link"
                        disabled={isBusy}
                        onClick={() => handleDeleteTask(task.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="task-actions">
                    {taskStatusActions.map((action) => (
                      <button
                        className={task.status === action.value ? "ghost-button active" : "ghost-button"}
                        key={action.value}
                        onClick={() => handleStatusUpdate(task.id, action.value)}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                    <button className="secondary-button" onClick={() => handleAssignToMe(task.id)} type="button">
                      Assign to Me
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
