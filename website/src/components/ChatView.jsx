import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import Suggestions from "./Suggestions";

export default function ChatView({ messages, busy, aiEnabled, hasSources, now, onSend, onAddTask }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function send(question) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  }

  if (!aiEnabled) {
    return (
      <div className="panel-body tasks-body">
        <div className="empty">
          <span className="empty-icon">
            <Sparkles size={26} />
          </span>
          <h3>AI isn't set up yet</h3>
          <p>
            Get an API key at console.anthropic.com, save it on the server Pi in <code>server/.env</code> as{" "}
            <code>ANTHROPIC_API_KEY=…</code>, then restart the server.
          </p>
        </div>
      </div>
    );
  }

  const starters = ["What's due today?", "Plan my evening", "What should I do first?"];
  if (hasSources) starters.push("What deadlines are in my files?");

  return (
    <>
      <div className="panel-body tasks-body chat-body">
        {messages.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <Sparkles size={26} />
            </span>
            <h3>Ask about your tasks</h3>
            <p>Claude can see your list{hasSources ? " and your uploaded files" : ""}.</p>
            <div className="starter-chips">
              {starters.map((q) => (
                <button key={q} type="button" className="chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg is-${m.role}${m.error ? " is-error" : ""}`}>
                {m.role === "assistant" && (
                  <span className="chat-avatar">
                    <Sparkles size={16} />
                  </span>
                )}
                <div className="chat-bubble">
                  <p>{m.content}</p>
                  {m.suggestions?.length > 0 && <Suggestions suggestions={m.suggestions} now={now} onAdd={onAddTask} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="chat-msg is-assistant">
                <span className="chat-avatar">
                  <Sparkles size={16} />
                </span>
                <div className="chat-bubble typing" aria-label="Claude is thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="composer-box">
          <input
            className="composer-input"
            placeholder="Ask anything about your tasks"
            aria-label="Ask Claude"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="send-btn" aria-label="Send" disabled={!text.trim() || busy}>
            <ArrowUp size={20} />
          </button>
        </div>
      </form>
    </>
  );
}
