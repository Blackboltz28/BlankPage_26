import { useId, useState } from "react";
import { Bell, LoaderCircle } from "lucide-react";
import { apiFetch } from "../api";
import { APP_NAME, SERVER_LABEL } from "../config";

export default function SignIn({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await apiFetch("/api/register", { method: "POST", body: { username, password } });
      }
      const data = await apiFetch("/api/login", { method: "POST", body: { username, password } });
      onSignedIn(data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-mark">
            <Bell size={20} />
          </span>
          {APP_NAME}
        </div>

        <h1 className="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">Your to-do list, with a Raspberry Pi that reminds you in person.</p>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <Field label="Username" value={username} onChange={setUsername} autoComplete="username" autoFocus />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !username.trim() || !password}>
            {busy && <LoaderCircle size={18} className="spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-footnote">Server: {SERVER_LABEL}</p>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", ...rest }) {
  const id = useId();
  return (
    <div className="field">
      <input id={id} type={type} value={value} placeholder=" " onChange={(e) => onChange(e.target.value)} {...rest} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
