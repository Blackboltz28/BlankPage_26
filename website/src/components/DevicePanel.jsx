import { BellRing, CalendarCheck, Cpu, Wifi, WifiOff } from "lucide-react";
import { API_URL } from "../config";
import { filterTasks, formatDue, formatRelative, nextDue, parseDue } from "../tasks";

const STATUS_TEXT = {
  checking: "Checking connection…",
  online: "Connected",
  offline: "Can't reach the server",
};

export default function DevicePanel({ status, tasks, now }) {
  const next = nextDue(tasks, now);
  const overdueCount = tasks.filter((t) => !t.done && t.due_at && parseDue(t.due_at) < now).length;

  const isToday = (t) => t.due_at && parseDue(t.due_at).toDateString() === now.toDateString();
  const doneToday = tasks.filter((t) => t.done && isToday(t)).length;
  const totalToday = doneToday + filterTasks(tasks, "today", now).filter(isToday).length;
  const percent = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  return (
    <section className="panel panel-device">
      <header className="panel-header">
        <h2>Raspberry Pi</h2>
      </header>

      <div className="panel-body device-body">
        <div className={`status-card is-${status}`}>
          <span className="status-icon">{status === "offline" ? <WifiOff size={20} /> : <Wifi size={20} />}</span>
          <div className="status-text">
            <div className="status-title">{STATUS_TEXT[status]}</div>
            <div className="status-sub">{API_URL.replace(/^https?:\/\//, "")}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-label">
            <BellRing size={16} />
            Up next
          </div>
          {next ? (
            <>
              <div className="next-title">{next.title}</div>
              <div className="next-when">
                {formatRelative(next.due_at, now)} · {formatDue(next.due_at, now)}
              </div>
            </>
          ) : (
            <div className="card-empty">No reminders scheduled</div>
          )}
          {overdueCount > 0 && <div className="overdue-note">{overdueCount} overdue</div>}
        </div>

        <div className="card">
          <div className="card-label">
            <CalendarCheck size={16} />
            Today
          </div>
          <div className="progress-row">
            <span className="progress-num">{doneToday}</span>
            of {totalToday} done
          </div>
          <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="card card-tonal">
          <div className="card-label">
            <Cpu size={16} />
            How it works
          </div>
          <p>When a task's due time arrives, your Pi reminds you in person, so you don't need your phone.</p>
        </div>
      </div>
    </section>
  );
}
