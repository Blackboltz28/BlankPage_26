import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { apiFetch } from "../api";
import { APP_NAME } from "../config";
import { useNow, useServerStatus } from "../hooks";
import { countByView, filterTasks } from "../tasks";
import DevicePanel from "./DevicePanel";
import ListsPanel from "./ListsPanel";
import TasksPanel from "./TasksPanel";

// On phones only one panel fits, so these tabs switch between them.
const TABS = [
  { id: "lists", label: "Lists" },
  { id: "tasks", label: "Tasks" },
  { id: "device", label: "Pi" },
];

export default function Workspace({ username, onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [tab, setTab] = useState("tasks");
  const [toast, setToast] = useState("");
  const composerRef = useRef(null);
  const wasOffline = useRef(false);
  const now = useNow();
  const status = useServerStatus();

  const loadTasks = useCallback(() => {
    apiFetch("/api/todos")
      .then((data) => setTasks(data.todos))
      .catch((err) => {
        if (err.status === 401) onSignOut();
        else setToast(err.message);
      })
      .finally(() => setLoading(false));
  }, [onSignOut]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Reload once the server comes back after being unreachable.
  useEffect(() => {
    if (status === "offline") wasOffline.current = true;
    if (status === "online" && wasOffline.current) {
      wasOffline.current = false;
      loadTasks();
    }
  }, [status, loadTasks]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  async function addTask(title, dueAt) {
    try {
      const task = await apiFetch("/api/todos", { method: "POST", body: { title, due_at: dueAt } });
      setTasks((ts) => [...ts, task]);
      return true;
    } catch (err) {
      setToast(err.message);
      return false;
    }
  }

  // Toggle and delete update the screen right away, then undo if the server says no.
  async function toggleTask(task) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    try {
      const updated = await apiFetch(`/api/todos/${task.id}`, { method: "PATCH", body: { done: !task.done } });
      setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
      setToast(err.message);
    }
  }

  async function deleteTask(task) {
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await apiFetch(`/api/todos/${task.id}`, { method: "DELETE" });
    } catch (err) {
      setTasks((ts) => [...ts, task]);
      setToast(err.message);
    }
  }

  function selectView(id) {
    setView(id);
    setTab("tasks");
  }

  function startNewTask() {
    if (view === "done") setView("all");
    setTab("tasks");
    // Wait a frame so the composer is on screen before focusing it.
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Bell size={18} />
          </span>
          {APP_NAME}
        </div>
        <div className="topbar-actions">
          <span className="avatar" title={username}>
            {username[0].toUpperCase()}
          </span>
          <button type="button" className="btn btn-text" onClick={onSignOut}>
            <LogOut size={18} />
            <span className="hide-sm">Sign out</span>
          </button>
        </div>
      </header>

      <nav className="segmented mobile-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="panels" data-tab={tab}>
        <ListsPanel view={view} counts={countByView(tasks, now)} onSelect={selectView} onNewTask={startNewTask} />
        <TasksPanel
          view={view}
          tasks={filterTasks(tasks, view, now)}
          loading={loading}
          now={now}
          composerRef={composerRef}
          onAdd={addTask}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
        <DevicePanel status={status} tasks={tasks} now={now} />
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
