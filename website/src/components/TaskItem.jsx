import { Bell, Check, Radio, Trash2 } from "lucide-react";
import { formatDue, parseDue } from "../tasks";

export default function TaskItem({ task, deviceName, now, onToggle, onDelete }) {
  const overdue = !task.done && task.due_at && parseDue(task.due_at) < now;

  return (
    <li className={`task${task.done ? " is-done" : ""}`}>
      <button
        type="button"
        className="task-check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onClick={() => onToggle(task)}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <div className="task-main">
        <span className="task-title">{task.title}</span>
        {(task.due_at || deviceName) && (
          <div className="task-chips">
            {task.due_at && (
              <span className={`due-chip${overdue ? " is-overdue" : ""}`}>
                <Bell size={13} />
                {formatDue(task.due_at, now)}
              </span>
            )}
            {deviceName && (
              <span className="due-chip">
                <Radio size={13} />
                {deviceName}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="icon-btn task-delete"
        aria-label={`Delete "${task.title}"`}
        title="Delete"
        onClick={() => onDelete(task)}
      >
        <Trash2 size={18} />
      </button>
    </li>
  );
}
