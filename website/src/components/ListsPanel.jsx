import { CalendarDays, CircleCheck, ListTodo, Plus, Sun } from "lucide-react";
import { VIEW_LABELS } from "../tasks";

const VIEW_ICONS = {
  all: ListTodo,
  today: Sun,
  upcoming: CalendarDays,
  done: CircleCheck,
};

export default function ListsPanel({ view, counts, onSelect, onNewTask }) {
  return (
    <section className="panel panel-lists">
      <header className="panel-header">
        <h2>Lists</h2>
      </header>
      <div className="panel-body">
        <button type="button" className="btn btn-outlined btn-block-sm" onClick={onNewTask}>
          <Plus size={18} />
          New task
        </button>
        <nav className="view-list">
          {Object.keys(VIEW_LABELS).map((id) => {
            const Icon = VIEW_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                className={`view-item${view === id ? " is-active" : ""}`}
                aria-current={view === id ? "page" : undefined}
                onClick={() => onSelect(id)}
              >
                <Icon size={20} />
                <span className="view-label">{VIEW_LABELS[id]}</span>
                <span className="view-count">{counts[id]}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
