import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useNow } from "../hooks";
import AmbientScreen from "./AmbientScreen";

const REFRESH_MS = 2000;

// Opened on another computer, the kiosk needs ?key=<KIOSK_KEY>. On the Pi itself it doesn't.
const key = new URLSearchParams(window.location.search).get("key");
const withKey = (path) => (key ? `${path}?key=${encodeURIComponent(key)}` : path);

// /kiosk: no sign-in. Shows the tasks of whoever's ESP32 tag has the strongest signal.
export default function Kiosk() {
  const now = useNow(1000);
  const [data, setData] = useState(null); // { scanner, person, nearby, tasks }
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(withKey("/api/kiosk"));
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error);
        setData(body);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message || "Can't reach the server");
      }
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function markDone(task) {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t)) }));
    await fetch(withKey(`/api/kiosk/todos/${task.id}/done`), { method: "POST" }).catch(() => {});
  }

  const person = data?.person;
  if (person) {
    // Keyed by name so switching people fades in fresh.
    return (
      <div key={person.name} className="kiosk-swap">
        <AmbientScreen tasks={data.tasks} now={now} name={person.name} onMarkDone={markDone} />
      </div>
    );
  }

  return (
    <div className="ambient ambient-idle">
      <div className="ambient-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
      <div className="ambient-date">
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </div>
      <p className="idle-hint">
        <Radio size={20} />
        Walk up with your tag to see your tasks
      </p>
      <p className="idle-status">{error || data?.scanner || "Connecting…"}</p>
    </div>
  );
}
