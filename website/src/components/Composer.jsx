import { useRef, useState } from "react";
import { ArrowUp, Clock, X } from "lucide-react";
import { formatDue, quickTimes } from "../tasks";

export default function Composer({ now, inputRef, onAdd }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(""); // "YYYY-MM-DDTHH:MM", or "" for no due time
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const added = await onAdd(trimmed, due || null);
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
          placeholder="Add a task, like “Take medicine”"
          aria-label="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="composer-actions">
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
            <ArrowUp size={20} />
          </button>
        </div>
      </div>
    </form>
  );
}
