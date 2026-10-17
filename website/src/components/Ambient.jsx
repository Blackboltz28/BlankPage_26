import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useNow } from "../hooks";
import AmbientScreen from "./AmbientScreen";

const REFRESH_MS = 15000;

// /ambient: the ambient display for the signed-in user. Press Esc to go back to the app.
export default function Ambient({ onSignOut }) {
  const now = useNow(1000);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiFetch("/api/todos")
        .then((data) => {
          if (!cancelled) setTasks(data.todos);
        })
        .catch((err) => {
          if (err.status === 401) onSignOut();
        });
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [onSignOut]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") window.location.href = "/";
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function markDone(task) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: true } : t)));
    try {
      await apiFetch(`/api/todos/${task.id}`, { method: "PATCH", body: { done: true } });
    } catch {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    }
  }

  return <AmbientScreen tasks={tasks} now={now} onMarkDone={markDone} />;
}
