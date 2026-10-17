import { useState } from "react";
import { BellRing, CalendarCheck, Copy, Plus, Radio, Trash2, Wifi, WifiOff } from "lucide-react";
import { SERVER_LABEL } from "../config";
import { filterTasks, formatDue, formatRelative, nextDue, parseDue } from "../tasks";

const STATUS_TEXT = {
  checking: "Checking connection…",
  online: "Server connected",
  offline: "Can't reach the server",
};

export default function DevicePanel({ status, tasks, devices, now, onAddDevice, onDeleteDevice, onTestDevice }) {
  const next = nextDue(tasks, now);
  const overdueCount = tasks.filter((t) => !t.done && t.due_at && parseDue(t.due_at) < now).length;

  const isToday = (t) => t.due_at && parseDue(t.due_at).toDateString() === now.toDateString();
  const doneToday = tasks.filter((t) => t.done && isToday(t)).length;
  const totalToday = doneToday + filterTasks(tasks, "today", now).filter(isToday).length;
  const percent = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  return (
    <section className="panel panel-device">
      <header className="panel-header">
        <h2>Devices</h2>
      </header>

      <div className="panel-body device-body">
        <div className={`status-card is-${status}`}>
          <span className="status-icon">{status === "offline" ? <WifiOff size={20} /> : <Wifi size={20} />}</span>
          <div className="status-text">
            <div className="status-title">{STATUS_TEXT[status]}</div>
            <div className="status-sub">{SERVER_LABEL}</div>
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

        <ReminderDevices devices={devices} onAdd={onAddDevice} onDelete={onDeleteDevice} onTest={onTestDevice} />
      </div>
    </section>
  );
}

function ReminderDevices({ devices, onAdd, onDelete, onTest }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState(null); // { name, key } of the device just added

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const device = await onAdd(name.trim());
    if (device) {
      setNewKey({ name: device.name, key: device.key });
      setName("");
      setAdding(false);
    }
  }

  return (
    <div className="card">
      <div className="card-label">
        <Radio size={16} />
        Reminder devices
        <button
          type="button"
          className="icon-btn icon-btn-sm card-label-action"
          aria-label="Add a device"
          title="Add an ESP32"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={18} />
        </button>
      </div>

      {adding && (
        <form className="device-add" onSubmit={handleAdd}>
          <input
            className="device-input"
            placeholder="Name, like Kitchen"
            aria-label="Device name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
            Add
          </button>
        </form>
      )}

      {newKey && (
        <div className="device-key-note">
          Put this key in the <strong>{newKey.name}</strong> ESP32 sketch:
          <KeyLine value={newKey.key} />
        </div>
      )}

      {devices.length === 0 && !adding && (
        <div className="card-empty">No ESP32s yet. Add one to get reminders around the house.</div>
      )}

      <ul className="device-list">
        {devices.map((device) => (
          <li key={device.id} className="device-row">
            <span className={`device-dot${device.online ? " is-online" : ""}`} title={device.online ? "Online" : "Offline"} />
            <div className="device-info">
              <span className="device-name">{device.name}</span>
              <span className="device-meta">{device.online ? "Online" : device.last_seen ? "Offline" : "Never connected"}</span>
            </div>
            <button type="button" className="icon-btn icon-btn-sm" title="Test beep" aria-label={`Test ${device.name}`} onClick={() => onTest(device)}>
              <BellRing size={16} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              title="Copy device key"
              aria-label={`Copy ${device.name}'s key`}
              onClick={() => copyText(device.key)}
            >
              <Copy size={16} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" title="Remove" aria-label={`Remove ${device.name}`} onClick={() => onDelete(device)}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyLine({ value }) {
  return (
    <div className="key-line">
      <code>{value}</code>
      <button type="button" className="icon-btn icon-btn-sm" aria-label="Copy key" onClick={() => copyText(value)}>
        <Copy size={16} />
      </button>
    </div>
  );
}

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}
