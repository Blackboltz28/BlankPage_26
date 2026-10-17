import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, MonitorPlay } from "lucide-react";
import { apiFetch } from "../api";
import { APP_NAME } from "../config";
import { useNow, useServerStatus } from "../hooks";
import { countByView, filterTasks } from "../tasks";
import DevicePanel from "./DevicePanel";
import ListsPanel from "./ListsPanel";
import SourceModal from "./SourceModal";
import TasksPanel from "./TasksPanel";

// On phones only one panel fits, so these tabs switch between them.
const TABS = [
  { id: "lists", label: "Lists" },
  { id: "tasks", label: "Tasks" },
  { id: "device", label: "Devices" },
];

const DEVICE_REFRESH_MS = 10_000;

export default function Workspace({ username, onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sources, setSources] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [mode, setMode] = useState("tasks"); // middle panel: "tasks" or "ask"
  const [tab, setTab] = useState("tasks");
  const [chat, setChat] = useState([]); // { role, content, suggestions?, error? }
  const [chatBusy, setChatBusy] = useState(false);
  const [uploading, setUploading] = useState(null); // name of the file being read
  const [openSource, setOpenSource] = useState(null);
  const [toast, setToast] = useState("");
  const composerRef = useRef(null);
  const wasOffline = useRef(false);
  const now = useNow();
  const status = useServerStatus();

  const handleError = useCallback(
    (err) => {
      if (err.status === 401) onSignOut();
      else setToast(err.message);
    },
    [onSignOut],
  );

  const loadData = useCallback(() => {
    apiFetch("/api/todos")
      .then((data) => setTasks(data.todos))
      .catch(handleError)
      .finally(() => setLoading(false));
    apiFetch("/api/devices").then((data) => setDevices(data.devices)).catch(() => {});
    apiFetch("/api/sources").then((data) => setSources(data.sources)).catch(() => {});
    apiFetch("/api/ai/status").then((data) => setAiEnabled(data.enabled)).catch(() => {});
  }, [handleError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload once the server comes back after being unreachable.
  useEffect(() => {
    if (status === "offline") wasOffline.current = true;
    if (status === "online" && wasOffline.current) {
      wasOffline.current = false;
      loadData();
    }
  }, [status, loadData]);

  // Keep the devices' online/offline dots fresh.
  useEffect(() => {
    const id = setInterval(() => {
      apiFetch("/api/devices").then((data) => setDevices(data.devices)).catch(() => {});
    }, DEVICE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // ----- Tasks -----

  async function addTask(title, dueAt, deviceId = null) {
    try {
      const task = await apiFetch("/api/todos", {
        method: "POST",
        body: { title, due_at: dueAt, device_id: deviceId },
      });
      setTasks((ts) => [...ts, task]);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  async function smartAdd(text, deviceId) {
    try {
      const data = await apiFetch("/api/ai/add", { method: "POST", body: { text, device_id: deviceId } });
      setTasks((ts) => [...ts, ...data.todos]);
      if (data.todos.length > 1) setToast(`Added ${data.todos.length} tasks`);
      return true;
    } catch (err) {
      handleError(err);
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
      handleError(err);
    }
  }

  async function deleteTask(task) {
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await apiFetch(`/api/todos/${task.id}`, { method: "DELETE" });
    } catch (err) {
      setTasks((ts) => [...ts, task]);
      handleError(err);
    }
  }

  // ----- Devices -----

  async function addDevice(name) {
    try {
      const device = await apiFetch("/api/devices", { method: "POST", body: { name } });
      setDevices((ds) => [...ds, device]);
      return device;
    } catch (err) {
      handleError(err);
      return null;
    }
  }

  async function deleteDevice(device) {
    setDevices((ds) => ds.filter((d) => d.id !== device.id));
    setTasks((ts) => ts.map((t) => (t.device_id === device.id ? { ...t, device_id: null } : t)));
    try {
      await apiFetch(`/api/devices/${device.id}`, { method: "DELETE" });
    } catch (err) {
      handleError(err);
      loadData();
    }
  }

  async function testDevice(device) {
    try {
      await apiFetch(`/api/devices/${device.id}/test`, { method: "POST" });
      setToast(`${device.name} will beep within a few seconds`);
    } catch (err) {
      handleError(err);
    }
  }

  // ----- Sources (uploaded files) -----

  async function uploadSource(file) {
    setUploading(file.name);
    const form = new FormData();
    form.append("file", file);
    try {
      const source = await apiFetch("/api/sources", { method: "POST", body: form });
      setSources((ss) => [source, ...ss]);
      setOpenSource(source);
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(null);
    }
  }

  async function deleteSource(source) {
    setOpenSource(null);
    setSources((ss) => ss.filter((s) => s.id !== source.id));
    try {
      await apiFetch(`/api/sources/${source.id}`, { method: "DELETE" });
    } catch (err) {
      setSources((ss) => [source, ...ss]);
      handleError(err);
    }
  }

  // ----- Ask (chat) -----

  async function sendChat(text) {
    const history = [...chat, { role: "user", content: text }];
    setChat(history);
    setChatBusy(true);
    try {
      const data = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: { messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) },
      });
      setChat((c) => [...c, { role: "assistant", content: data.reply, suggestions: data.suggestions }]);
    } catch (err) {
      if (err.status === 401) onSignOut();
      setChat((c) => [...c, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setChatBusy(false);
    }
  }

  // ----- Navigation -----

  function selectView(id) {
    setView(id);
    setMode("tasks");
    setTab("tasks");
  }

  function startNewTask() {
    if (view === "done") setView("all");
    setMode("tasks");
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
          <a className="btn btn-text" href="/ambient" title="Full-screen kiosk view">
            <MonitorPlay size={18} />
            <span className="hide-sm">Ambient mode</span>
          </a>
          <span className="avatar" title={username}>
            {username[0].toUpperCase()}
          </span>
          <button type="button" className="icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            <LogOut size={18} />
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
        <ListsPanel
          view={view}
          counts={countByView(tasks, now)}
          sources={sources}
          uploading={uploading}
          onSelect={selectView}
          onNewTask={startNewTask}
          onUpload={uploadSource}
          onOpenSource={setOpenSource}
        />
        <TasksPanel
          view={view}
          mode={mode}
          onModeChange={setMode}
          tasks={filterTasks(tasks, view, now)}
          devices={devices}
          loading={loading}
          now={now}
          aiEnabled={aiEnabled}
          composerRef={composerRef}
          onAdd={addTask}
          onSmartAdd={smartAdd}
          onToggle={toggleTask}
          onDelete={deleteTask}
          chat={chat}
          chatBusy={chatBusy}
          hasSources={sources.length > 0}
          onSendChat={sendChat}
        />
        <DevicePanel
          status={status}
          tasks={tasks}
          devices={devices}
          now={now}
          onAddDevice={addDevice}
          onDeleteDevice={deleteDevice}
          onTestDevice={testDevice}
        />
      </main>

      {openSource && (
        <SourceModal
          source={openSource}
          now={now}
          onClose={() => setOpenSource(null)}
          onAddTask={(task) => addTask(task.title, task.due_at)}
          onDelete={deleteSource}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
