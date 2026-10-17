import { useRef, useState } from "react";
import { ArrowUp, Clock, LoaderCircle, Sparkles, X } from "lucide-react";
import { formatDue, quickTimes } from "../tasks";

export default function Composer({ now, devices, aiEnabled, inputRef, onAdd, onSmartAdd }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(""); // "YYYY-MM-DDTHH:MM", or "" for no due time
  const [deviceId, setDeviceId] = useState(""); // "" means all devices
  const [smart, setSmart] = useState(true);
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef(null);

  // Smart add lets Claude work out the time from the sentence, unless you picked one yourself.
  const smartMode = aiEnabled && smart && !due;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const device = deviceId ? Number(deviceId) : null;
    const added = smartMode ? await onSmartAdd(trimmed, device) : await onAdd(trimmed, due || null, device);
    setBusy(false);
    if (added) {
      setTitle("");
      setDue("");
    }
  }

  // The real date picker is hidden; the "Due time" chip opens it.
  function openPicker() {
    const picker = pickerRef.current;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="quick-times">
        {aiEnabled && (
          <button
            type="button"
            className={`chip${smart ? " is-selected" : ""}`}
            aria-pressed={smart}
            title="Claude reads times like “Friday at 6” from what you type"
            onClick={() => setSmart(!smart)}
          >
            <Sparkles size={15} />
            Smart add
          </button>
        )}
        {quickTimes(now).map((option) => (
          <button
            key={option.label}
            type="button"
            className={`chip${due === option.value ? " is-selected" : ""}`}
            onClick={() => setDue(due === option.value ? "" : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="composer-box">
        <input
          ref={inputRef}
          className="composer-input"
          placeholder={smartMode ? "Try “call mom Friday at 6pm”" : "Add a task, like “Take medicine”"}
          aria-label="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="composer-actions">
          {devices.length > 0 && (
            <select
              className="chip chip-select"
              aria-label="Which device reminds you"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <div className="due-picker">
            <button type="button" className={`chip${due ? " is-selected" : ""}`} onClick={openPicker}>
              <Clock size={16} />
              {due ? formatDue(due, now) : "Due time"}
            </button>
            {due && (
              <button type="button" className="icon-btn icon-btn-sm" aria-label="Clear due time" onClick={() => setDue("")}>
                <X size={16} />
              </button>
            )}
            <input
              ref={pickerRef}
              type="datetime-local"
              className="native-picker"
              tabIndex={-1}
              aria-hidden="true"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <button type="submit" className="send-btn" aria-label="Add task" disabled={!title.trim() || busy}>
            {busy ? <LoaderCircle size={20} className="spin" /> : <ArrowUp size={20} />}
          </button>
        </div>
      </div>
    </form>
  );
}
