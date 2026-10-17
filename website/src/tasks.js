// Helpers for sorting, grouping and displaying tasks.
// Due times are local "YYYY-MM-DDTHH:MM" strings, which is what <input type="datetime-local"> uses.

const DAY_MS = 24 * 60 * 60 * 1000;

export const VIEW_LABELS = {
  all: "All tasks",
  today: "Today",
  upcoming: "Upcoming",
  done: "Completed",
};

export function parseDue(due) {
  return due ? new Date(due) : null;
}

export function toInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 0 = today, 1 = tomorrow, -1 = yesterday, ...
function daysFromToday(date, now) {
  return Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
}

export function formatDue(due, now) {
  const date = parseDue(due);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = daysFromToday(date, now);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
  return `${day}, ${time}`;
}

export function formatRelative(due, now) {
  const minutes = Math.round((parseDue(due) - now) / 60000);
  const abs = Math.abs(minutes);
  if (abs < 1) return "Due now";
  let amount;
  if (abs < 60) amount = `${abs} min`;
  else if (abs < 60 * 24) amount = `${Math.round(abs / 60)} hr`;
  else {
    const days = Math.round(abs / (60 * 24));
    amount = `${days} ${days === 1 ? "day" : "days"}`;
  }
  return minutes > 0 ? `In ${amount}` : `${amount} overdue`;
}

export function filterTasks(tasks, view, now) {
  switch (view) {
    case "today":
      return tasks.filter((t) => !t.done && t.due_at && daysFromToday(parseDue(t.due_at), now) <= 0);
    case "upcoming":
      return tasks.filter((t) => !t.done && t.due_at && daysFromToday(parseDue(t.due_at), now) > 0);
    case "done":
      return tasks.filter((t) => t.done);
    default:
      return tasks.filter((t) => !t.done);
  }
}

export function countByView(tasks, now) {
  return Object.fromEntries(
    Object.keys(VIEW_LABELS).map((view) => [view, filterTasks(tasks, view, now).length]),
  );
}

const byDue = (a, b) => a.due_at.localeCompare(b.due_at);

// Splits not-done tasks into Overdue / Today / Tomorrow / Later / No due time.
export function groupTasks(tasks, now) {
  const groups = { overdue: [], today: [], tomorrow: [], later: [], none: [] };
  for (const task of tasks) {
    if (!task.due_at) {
      groups.none.push(task);
      continue;
    }
    const due = parseDue(task.due_at);
    const days = daysFromToday(due, now);
    if (due < now) groups.overdue.push(task);
    else if (days === 0) groups.today.push(task);
    else if (days === 1) groups.tomorrow.push(task);
    else groups.later.push(task);
  }
  return [
    { key: "overdue", label: "Overdue", tasks: groups.overdue.sort(byDue) },
    { key: "today", label: "Today", tasks: groups.today.sort(byDue) },
    { key: "tomorrow", label: "Tomorrow", tasks: groups.tomorrow.sort(byDue) },
    { key: "later", label: "Later", tasks: groups.later.sort(byDue) },
    { key: "none", label: "No due time", tasks: groups.none },
  ].filter((group) => group.tasks.length > 0);
}

// The next task the Pi will remind you about.
export function nextDue(tasks, now) {
  return tasks
    .filter((t) => !t.done && t.due_at && parseDue(t.due_at) >= now)
    .sort(byDue)[0];
}

export function quickTimes(now) {
  const inMinutes = (n) => new Date(now.getTime() + n * 60000);
  const options = [
    { label: "In 1 minute", value: toInputValue(inMinutes(1)) },
    { label: "In 1 hour", value: toInputValue(inMinutes(60)) },
  ];
  if (now.getHours() < 19) {
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    options.push({ label: "Tonight, 8 PM", value: toInputValue(tonight) });
  }
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9);
  options.push({ label: "Tomorrow, 9 AM", value: toInputValue(tomorrow) });
  return options;
}
