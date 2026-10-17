import { useEffect } from "react";
import { FileText, Image, Trash2, X } from "lucide-react";
import Suggestions from "./Suggestions";

export default function SourceModal({ source, now, onClose, onAddTask, onDelete }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = source.media_type.startsWith("image/") ? Image : FileText;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <span className="empty-icon modal-icon">
            <Icon size={20} />
          </span>
          <h2 id="source-title">{source.name}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="modal-body">
          <h3 className="modal-section">Summary</h3>
          <p className="modal-summary">{source.summary}</p>

          <h3 className="modal-section">Tasks found</h3>
          {source.suggestions.length ? (
            <Suggestions suggestions={source.suggestions} now={now} onAdd={onAddTask} />
          ) : (
            <p className="card-empty">No tasks or dates in this file.</p>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-text btn-danger" onClick={() => onDelete(source)}>
            <Trash2 size={18} />
            Remove source
          </button>
        </footer>
      </div>
    </div>
  );
}
