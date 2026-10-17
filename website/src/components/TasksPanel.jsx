import { CalendarDays, CircleCheck, ListTodo, Sun } from "lucide-react";
import { groupTasks, VIEW_LABELS } from "../tasks";
import Composer from "./Composer";
import TaskItem from "./TaskItem";

const EMPTY_STATES = {
  all: {
    icon: ListTodo,
    title: "No tasks yet",
    text: "Add one below. Give it a due time and your Pi will remind you when it's time.",
  },
  today: { icon: Sun, title: "Nothing due today", text: "Enjoy the free time, or add something below." },
  upcoming: { icon: CalendarDays, title: "Nothing coming up", text: "Tasks due after today show up here." },
  done: { icon: CircleCheck, title: "Nothing completed yet", text: "Tick off a task and it lands here." },
};

export default function TasksPanel({ view, tasks, loading, now, composerRef, onAdd, onToggle, onDelete }) {
  const groups = view === "done" ? [{ key: "done", label: "Completed", tasks }] : groupTasks(tasks, now);
  const summary = view === "done" ? `${tasks.length} completed` : `${tasks.length} to do`;

  return (
    <section className="panel panel-tasks">
      <header className="panel-header">
        <h2>{VIEW_LABELS[view]}</h2>
        {!loading && <span className="panel-meta">{summary}</span>}
      </header>

      <div className="panel-body tasks-body">
        {loading ? (
          <div className="task-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState {...EMPTY_STATES[view]} />
        ) : (
          groups.map((group) => (
            <div key={group.key} className="task-group">
              <h3 className={`group-label${group.key === "overdue" ? " is-overdue" : ""}`}>
                {group.label}
                <span>{group.tasks.length}</span>
              </h3>
              <ul className="task-list">
                {group.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} now={now} onToggle={onToggle} onDelete={onDelete} />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {view !== "done" && <Composer now={now} inputRef={composerRef} onAdd={onAdd} />}
    </section>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
