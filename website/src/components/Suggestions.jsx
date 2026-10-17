import { useState } from "react";
import { Bell, Check, Plus } from "lucide-react";
import { formatDue } from "../tasks";

// Tasks Claude suggested (from a file or the chat), each with an Add button.
export default function Suggestions({ suggestions, now, onAdd }) {
  const [added, setAdded] = useState(() => new Set());

  async function add(index) {
    if (added.has(index)) return;
    if (await onAdd(suggestions[index])) {
      setAdded((s) => new Set(s).add(index));
    }
  }

  async function addAll() {
    for (let i = 0; i < suggestions.length; i++) await add(i);
  }

  const remaining = suggestions.length - added.size;

  return (
    <div className="suggestions">
      <ul>
        {suggestions.map((task, i) => (
          <li key={i} className="suggestion">
            <div className="task-main">
              <span className="task-title">{task.title}</span>
              {task.due_at && (
                <span className="due-chip">
                  <Bell size={13} />
                  {formatDue(task.due_at, now)}
                </span>
              )}
            </div>
            <button
              type="button"
              className={`chip${added.has(i) ? " is-selected" : ""}`}
              disabled={added.has(i)}
              onClick={() => add(i)}
            >
              {added.has(i) ? <Check size={16} /> : <Plus size={16} />}
              {added.has(i) ? "Added" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {suggestions.length > 1 && remaining > 0 && (
        <button type="button" className="btn btn-text suggestions-all" onClick={addAll}>
          Add all {remaining}
        </button>
      )}
    </div>
  );
}
