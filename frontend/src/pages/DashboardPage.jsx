import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSoundPreferences } from "../hooks/useSoundPreferences";

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
];

const completionSoundUrl = `${import.meta.env.BASE_URL}TaskCompleteSound.mp3`;
const neutralSoundUrl = `${import.meta.env.BASE_URL}NeutralClick.mp3`;
const warningSoundUrl = `${import.meta.env.BASE_URL}WarningSound.mp3`;
const undoDisplayMs = 5000;

function getAssigneeLabel(task, user) {
  if (!task.assignee) {
    return "No accountability buddy assigned.";
  }

  if (task.assignee.id === user?.id) {
    return `Assigned to you (${task.assignee.email})`;
  }

  return `Assigned to ${task.assignee.name} (${task.assignee.email})`;
}

function resolveSelectedProjectId(projects, preferredProjectId) {
  const preferredId = preferredProjectId ? String(preferredProjectId) : "";

  if (preferredId && projects.some((project) => String(project.id) === preferredId)) {
    return preferredId;
  }

  return projects[0] ? String(projects[0].id) : "";
}

export default function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const { isMuted, playSound, setIsMuted, setVolume, volume } = useSoundPreferences();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [undoNotice, setUndoNotice] = useState(null);
  const [error, setError] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isRestoringUndo, setIsRestoringUndo] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState(null);
  const [busyTaskId, setBusyTaskId] = useState(null);

  const deleteTriggerRef = useRef(null);
  const confirmDeleteButtonRef = useRef(null);
  const cancelDeleteButtonRef = useRef(null);

  const selectedProject =
    projects.find((project) => String(project.id) === String(selectedProjectId)) || null;

  const playNeutralSound = () => {
    playSound(neutralSoundUrl);
  };

  const resetTaskComposer = () => {
    setEditingTaskId(null);
    setTaskForm(initialTaskForm);
  };

  const refreshProjects = async (preferredProjectId = selectedProjectId) => {
    const loadedProjects = await api.listProjects(token);
    setProjects(loadedProjects);
    setSelectedProjectId(resolveSelectedProjectId(loadedProjects, preferredProjectId));
    return loadedProjects;
  };

  const refreshTasks = async (projectId = selectedProjectId, filter = statusFilter) => {
    if (!projectId) {
      setTasks([]);
      return [];
    }

    const loadedTasks = await api.listTasks(token, {
      projectId,
      status: filter,
    });
    setTasks(loadedTasks);

    if (editingTaskId && !loadedTasks.some((task) => task.id === editingTaskId)) {
      resetTaskComposer();
    }

    return loadedTasks;
  };

  const closeDeleteDialog = (shouldPlayNeutral = false, shouldRestoreFocus = true) => {
    if (shouldPlayNeutral) {
      playNeutralSound();
    }

    setPendingDeleteItem(null);

    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => {
        deleteTriggerRef.current?.focus();
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const loadedProjects = await api.listProjects(token);
        if (!isMounted) {
          return;
        }

        setProjects(loadedProjects);
        setSelectedProjectId((current) => resolveSelectedProjectId(loadedProjects, current));
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
    if (!selectedProjectId) {
      setTasks([]);
      resetTaskComposer();
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
          resetTaskComposer();
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

  useEffect(() => {
    if (!pendingDeleteItem) {
      return;
    }

    window.requestAnimationFrame(() => {
      confirmDeleteButtonRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDeleteDialog(true);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableButtons = [confirmDeleteButtonRef.current, cancelDeleteButtonRef.current].filter(Boolean);
      if (focusableButtons.length < 2) {
        return;
      }

      const firstButton = focusableButtons[0];
      const lastButton = focusableButtons[focusableButtons.length - 1];

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      }

      if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDeleteItem]);

  useEffect(() => {
    if (!undoNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUndoNotice(null);
    }, undoDisplayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [undoNotice]);

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
    playNeutralSound();
    setIsCreatingProject(true);
    setError("");

    try {
      const project = await api.createProject(token, projectForm);
      setProjects((current) => [project, ...current]);
      setProjectForm(initialProjectForm);
      setSelectedProjectId(String(project.id));
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (project) => {
    setBusyProjectId(project.id);
    setError("");

    try {
      await api.deleteProject(token, project.id);
      closeDeleteDialog(false, false);

      const removedSelectedProject = String(selectedProjectId) === String(project.id);
      if (removedSelectedProject) {
        setTasks([]);
        resetTaskComposer();
      }

      await refreshProjects(removedSelectedProject ? "" : selectedProjectId);
      setUndoNotice({
        id: project.id,
        title: project.name,
        type: "project",
      });
    } catch (deletionError) {
      setError(deletionError.message);
    } finally {
      setBusyProjectId(null);
    }
  };

  const handleSubmitTask = async (event) => {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Create a focus area before adding actions.");
      return;
    }

    playNeutralSound();
    setIsSavingTask(true);
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
      setIsSavingTask(false);
    }
  };

  const handleDeleteTask = async (task) => {
    setBusyTaskId(task.id);
    setError("");

    try {
      await api.deleteTask(token, task.id);
      closeDeleteDialog(false, false);

      if (editingTaskId === task.id) {
        resetTaskComposer();
      }

      await refreshTasks();
      setUndoNotice({
        id: task.id,
        projectId: task.project_id,
        title: task.title,
        type: "task",
      });
    } catch (deletionError) {
      setError(deletionError.message);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoNotice) {
      return;
    }

    playNeutralSound();
    setIsRestoringUndo(true);
    setError("");

    try {
      if (undoNotice.type === "project") {
        const restoredProject = await api.restoreProject(token, undoNotice.id);
        await refreshProjects(restoredProject.id);
      } else {
        const restoredTask = await api.restoreTask(token, undoNotice.id);

        if (String(restoredTask.project_id) === String(selectedProjectId)) {
          await refreshTasks();
        } else {
          setSelectedProjectId(String(restoredTask.project_id));
        }
      }

      setUndoNotice(null);
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setIsRestoringUndo(false);
    }
  };

  const handlePromptDeleteProject = (project, triggerElement) => {
    deleteTriggerRef.current = triggerElement;
    setPendingDeleteItem({
      item: project,
      type: "project",
    });
    playSound(warningSoundUrl);
  };

  const handlePromptDeleteTask = (task, triggerElement) => {
    deleteTriggerRef.current = triggerElement;
    setPendingDeleteItem({
      item: task,
      type: "task",
    });
    playSound(warningSoundUrl);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteItem) {
      return;
    }

    if (pendingDeleteItem.type === "project") {
      await handleDeleteProject(pendingDeleteItem.item);
      return;
    }

    await handleDeleteTask(pendingDeleteItem.item);
  };

  const handleStatusUpdate = async (taskId, nextStatus) => {
    playNeutralSound();
    setBusyTaskId(taskId);
    setError("");

    try {
      await api.updateTask(token, taskId, { status: nextStatus });
      await refreshTasks();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleCompleteTask = async (taskId) => {
    setBusyTaskId(taskId);
    setError("");

    try {
      await api.updateTask(token, taskId, { status: "done" });
      await refreshTasks();
      playSound(completionSoundUrl);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAssignToMe = async (taskId) => {
    playNeutralSound();
    setBusyTaskId(taskId);
    setError("");

    try {
      await api.updateTask(token, taskId, { assignee_id: user.id });
      await refreshTasks();
    } catch (assignmentError) {
      setError(assignmentError.message);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleEditTask = (task) => {
    playNeutralSound();
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
    });
  };

  const handleSelectProject = (projectId) => {
    playNeutralSound();
    setSelectedProjectId(String(projectId));
  };

  const handleCancelEdit = () => {
    playNeutralSound();
    resetTaskComposer();
  };

  const handleStatusFilterChange = (event) => {
    playNeutralSound();
    setStatusFilter(event.target.value);
  };

  const handleSignOut = () => {
    playNeutralSound();
    signOut();
  };

  const handleToggleMute = () => {
    if (!isMuted) {
      playNeutralSound();
    }

    setIsMuted((current) => !current);
  };

  const handleVolumeChange = (event) => {
    setVolume(event.target.value);
  };

  const handleVolumeCommit = () => {
    playNeutralSound();
  };

  const handleDismissUndo = () => {
    playNeutralSound();
    setUndoNotice(null);
  };

  if (isBootstrapping) {
    return (
      <div className="page-shell centered-shell">
        <div className="glass-panel loading-card">Loading focus planner...</div>
      </div>
    );
  }

  const deleteActionBusy =
    pendingDeleteItem &&
    ((pendingDeleteItem.type === "project" && busyProjectId === pendingDeleteItem.item.id) ||
      (pendingDeleteItem.type === "task" && busyTaskId === pendingDeleteItem.item.id));

  return (
    <div className="dashboard-shell">
      {pendingDeleteItem ? (
        <div className="modal-overlay" role="presentation">
          <div
            aria-describedby="delete-item-copy"
            aria-labelledby="delete-item-title"
            aria-modal="true"
            className="confirm-modal glass-panel"
            role="dialog"
          >
            <span className="eyebrow">Confirm Delete</span>
            <h2 id="delete-item-title">Delete this {pendingDeleteItem.type}?</h2>
            <p className="muted-copy" id="delete-item-copy">
              {pendingDeleteItem.type === "project"
                ? `${pendingDeleteItem.item.name} and all of its actions will be hidden until you undo the deletion.`
                : `${pendingDeleteItem.item.title} will be hidden until you undo the deletion.`}
            </p>
            <div className="modal-actions">
              <button
                className="danger-link"
                disabled={deleteActionBusy}
                onClick={handleConfirmDelete}
                ref={confirmDeleteButtonRef}
                type="button"
              >
                {pendingDeleteItem.type === "project" ? "Delete Focus Area" : "Delete Task"}
              </button>
              <button
                className="ghost-button"
                disabled={deleteActionBusy}
                onClick={() => closeDeleteDialog(true)}
                ref={cancelDeleteButtonRef}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {undoNotice ? (
        <div aria-live="polite" className="undo-toast glass-panel" role="status">
          <div>
            <strong>{undoNotice.type === "project" ? "Focus area deleted." : "Task deleted."}</strong>
            <p>{undoNotice.title}</p>
          </div>
          <div className="undo-toast-actions">
            <button className="ghost-button" disabled={isRestoringUndo} onClick={handleUndoDelete} type="button">
              Undo
            </button>
            <button className="link-button" onClick={handleDismissUndo} type="button">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <header className="top-bar">
        <div>
          <span className="eyebrow">ADHD Focus Space</span>
          <h1>ADHD Focus Tracking System</h1>
          <p className="muted-copy">
            Focus areas, next actions, status filters, lightweight accountability, and visible completion history.
          </p>
        </div>
        <div className="user-actions">
          <div className="sound-preferences">
            <button className="ghost-button" onClick={handleToggleMute} type="button">
              {isMuted ? "Unmute Sounds" : "Mute Sounds"}
            </button>
            <label className="sound-slider">
              Volume
              <input
                aria-label="Sound volume"
                max="1"
                min="0"
                onChange={handleVolumeChange}
                onKeyUp={handleVolumeCommit}
                onPointerUp={handleVolumeCommit}
                step="0.05"
                type="range"
                value={volume}
              />
            </label>
          </div>
          <div className="user-chip">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="secondary-button" onClick={handleSignOut} type="button">
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
            <button className="primary-button" disabled={isCreatingProject} type="submit">
              {isCreatingProject ? "Creating..." : "Create Focus Area"}
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
                    <button className="project-select" onClick={() => handleSelectProject(project.id)} type="button">
                      <strong>{project.name}</strong>
                      <p>{project.description || "No note added yet."}</p>
                    </button>
                    <button
                      className="danger-link"
                      disabled={busyProjectId === project.id}
                      onClick={(event) => handlePromptDeleteProject(project, event.currentTarget)}
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
              <select onChange={handleStatusFilterChange} value={statusFilter}>
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
              <button className="primary-button" disabled={isSavingTask || !selectedProjectId} type="submit">
                {isSavingTask ? "Saving..." : editingTaskId ? "Save Action" : "Add Action"}
              </button>
              {editingTaskId ? (
                <button className="link-button" onClick={handleCancelEdit} type="button">
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="task-list">
            {tasks.length === 0 ? (
              <p className="empty-state">No actions match this view yet.</p>
            ) : (
              tasks.map((task) => {
                const taskIsBusy = busyTaskId === task.id;

                return (
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
                        <button className="ghost-button" disabled={taskIsBusy} onClick={() => handleEditTask(task)} type="button">
                          Edit
                        </button>
                        <button
                          className="danger-link"
                          disabled={taskIsBusy}
                          onClick={(event) => handlePromptDeleteTask(task, event.currentTarget)}
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
                          disabled={taskIsBusy}
                          key={action.value}
                          onClick={() => handleStatusUpdate(task.id, action.value)}
                          type="button"
                        >
                          {action.label}
                        </button>
                      ))}
                      <button
                        className={task.status === "done" ? "ghost-button active" : "ghost-button"}
                        disabled={taskIsBusy || task.status === "done"}
                        onClick={() => handleCompleteTask(task.id)}
                        type="button"
                      >
                        Done
                      </button>
                      <button
                        className="secondary-button"
                        disabled={taskIsBusy}
                        onClick={() => handleAssignToMe(task.id)}
                        type="button"
                      >
                        Assign to Me
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
