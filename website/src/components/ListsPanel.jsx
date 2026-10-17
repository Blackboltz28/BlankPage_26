import { useRef } from "react";
import { CalendarDays, CircleCheck, FileText, Image, ListTodo, LoaderCircle, Plus, Sun } from "lucide-react";
import { VIEW_LABELS } from "../tasks";

const VIEW_ICONS = {
  all: ListTodo,
  today: Sun,
  upcoming: CalendarDays,
  done: CircleCheck,
};

export default function ListsPanel({ view, counts, sources, uploading, onSelect, onNewTask, onUpload, onOpenSource }) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // lets you pick the same file again later
    if (file) onUpload(file);
  }

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

        <div className="section-header">
          <h3>Sources</h3>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label="Add a source file"
            title="Add a PDF, photo or note"
            disabled={Boolean(uploading)}
            onClick={() => fileRef.current.click()}
          >
            <Plus size={18} />
          </button>
          <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,image/*" onChange={handleFile} />
        </div>

        <div className="source-list">
          {uploading && (
            <div className="source-item is-uploading">
              <LoaderCircle size={18} className="spin" />
              <span className="source-name">Reading {uploading}…</span>
            </div>
          )}
          {sources.map((source) => {
            const Icon = source.media_type.startsWith("image/") ? Image : FileText;
            return (
              <button key={source.id} type="button" className="source-item" onClick={() => onOpenSource(source)}>
                <Icon size={18} />
                <span className="source-name">{source.name}</span>
              </button>
            );
          })}
          {!uploading && sources.length === 0 && (
            <button type="button" className="sources-empty" onClick={() => fileRef.current.click()}>
              Add a PDF, photo or note. Claude finds the tasks and dates in it.
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
