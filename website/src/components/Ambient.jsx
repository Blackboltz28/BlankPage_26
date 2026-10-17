import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { apiFetch } from "../api";
import { useNow } from "../hooks";
import { formatDue, formatRelative, parseDue } from "../tasks";

const ROTATE_MS = 8000;
const REFRESH_MS = 15000;
// A task stays on the full-screen alert for up to an hour after it comes due.
const ALERT_WINDOW_MS = 60 * 60 * 1000;

const byDue = (a, b) => a.due_at.localeCompare(b.due_at);

// Full-screen kiosk view: a big clock, upcoming tasks that rotate, and a takeover when one comes due.
// Press Esc to go back to the normal app.
export default function Ambient({ onSignOut }) {
  const now = useNow(1000);
  const [tasks, setTasks] = useState([]);
  const [tick, setTick] = useState(0);

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
    const id = setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

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

  const scheduled = tasks.filter((t) => !t.done && t.due_at).sort(byDue);
  const dueNow = scheduled.filter((t) => {
    const late = now - parseDue(t.due_at);
    return late >= 0 && late < ALERT_WINDOW_MS;
  });
  const upcoming = scheduled.filter((t) => parseDue(t.due_at) > now).slice(0, 6);
  const featured = upcoming.length ? upcoming[tick % upcoming.length] : null;

  // What's left today first, finished ones after, so small screens show what matters.
  const today = tasks
    .filter((t) => t.due_at && parseDue(t.due_at).toDateString() === now.toDateString())
    .sort((a, b) => a.done - b.done || byDue(a, b));
  const doneToday = today.filter((t) => t.done).length;
  const night = now.getHours() >= 22 || now.getHours() < 7;

  if (dueNow.length > 0) {
    const task = dueNow[0];
    return (
      <div className={`ambient ambient-alert${night ? " is-night" : ""}`}>
        <div className="alert-ring">
          <BellRing size={64} />
        </div>
        <p className="ambient-label">It's time</p>
        <h1 className="alert-title">{task.title}</h1>
        <p className="ambient-when">Due {formatDue(task.due_at, now)}</p>
        <button type="button" className="alert-done" onClick={() => markDone(task)}>
          <Check size={22} />
          Mark done
        </button>
        {dueNow.length > 1 && <p className="alert-more">+{dueNow.length - 1} more due</p>}
      </div>
    );
  }

  return (
    <div className={`ambient${night ? " is-night" : ""}`}>
      <section className="ambient-main">
        <div>
          <div className="ambient-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          <div className="ambient-date">
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>

        <div className="ambient-next">
          <p className="ambient-label">Up next</p>
          {featured ? (
            <div key={featured.id} className="ambient-feature">
              <h1 className="ambient-title">{featured.title}</h1>
              <p className="ambient-when">
                {formatRelative(featured.due_at, now)} · {formatDue(featured.due_at, now)}
              </p>
            </div>
          ) : (
            <div className="ambient-feature">
              <h1 className="ambient-title">All clear</h1>
              <p className="ambient-when">Nothing scheduled. Enjoy it.</p>
            </div>
          )}
          {upcoming.length > 1 && (
            <div className="ambient-dots">
              {upcoming.map((t, i) => (
                <span key={t.id} className={i === tick % upcoming.length ? "is-active" : ""} />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="ambient-side">
        <h2>Today</h2>
        <p className="ambient-progress-text">
          {doneToday} of {today.length} done
        </p>
        <div className="ambient-progress">
          <div style={{ width: `${today.length ? (doneToday / today.length) * 100 : 0}%` }} />
        </div>
        <ul className="ambient-list">
          {today.length === 0 && <li className="ambient-empty">Nothing due today</li>}
          {today.map((t) => (
            <li key={t.id} className={t.done ? "is-done" : ""}>
              <span className="ambient-check">{t.done && <Check size={16} strokeWidth={3} />}</span>
              <span className="ambient-item-title">{t.title}</span>
              <span className="ambient-item-time">
                {parseDue(t.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
