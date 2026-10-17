import { CalendarDays, CircleCheck, ListTodo, Sparkles, Sun } from "lucide-react";
import { groupTasks, VIEW_LABELS } from "../tasks";
import ChatView from "./ChatView";
import Composer from "./Composer";
import TaskItem from "./TaskItem";

const EMPTY_STATES = {
  all: {
    icon: ListTodo,
    title: "No tasks yet",
    text: "Add one below. Give it a due time and your devices will remind you when it's time.",
  },
  today: { icon: Sun, title: "Nothing due today", text: "Enjoy the free time, or add something below." },
  upcoming: { icon: CalendarDays, title: "Nothing coming up", text: "Tasks due after today show up here." },
  done: { icon: CircleCheck, title: "Nothing completed yet", text: "Tick off a task and it lands here." },
};

export default function TasksPanel({
  view,
  mode,
  onModeChange,
  tasks,
  devices,
  loading,
  now,
  aiEnabled,
  composerRef,
  onAdd,
  onSmartAdd,
  onToggle,
  onDelete,
  chat,
  chatBusy,
  hasSources,
  onSendChat,
}) {
  const groups = view === "done" ? [{ key: "done", label: "Completed", tasks }] : groupTasks(tasks, now);
  const summary = view === "done" ? `${tasks.length} completed` : `${tasks.length} to do`;
  const deviceNames = Object.fromEntries(devices.map((d) => [d.id, d.name]));

  return (
    <section className="panel panel-tasks">
      <header className="panel-header">
        <div className="segmented segmented-sm" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "tasks"} onClick={() => onModeChange("tasks")}>
            Tasks
          </button>
          <button type="button" role="tab" aria-selected={mode === "ask"} onClick={() => onModeChange("ask")}>
            <Sparkles size={15} />
            Ask AI
          </button>
        </div>
        {mode === "tasks" && !loading && (
          <span className="panel-meta">
            {VIEW_LABELS[view]} · {summary}
          </span>
        )}
      </header>

      {mode === "ask" ? (
        <ChatView
          messages={chat}
          busy={chatBusy}
          aiEnabled={aiEnabled}
          hasSources={hasSources}
          now={now}
          onSend={onSendChat}
          onAddTask={(task) => onAdd(task.title, task.due_at)}
        />
      ) : (
        <>
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
                      <TaskItem
                        key={task.id}
                        task={task}
                        deviceName={deviceNames[task.device_id]}
                        now={now}
                        onToggle={onToggle}
                        onDelete={onDelete}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {view !== "done" && (
            <Composer
              now={now}
              devices={devices}
              aiEnabled={aiEnabled}
              inputRef={composerRef}
              onAdd={onAdd}
              onSmartAdd={onSmartAdd}
            />
          )}
        </>
      )}
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
