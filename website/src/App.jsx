import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import Ambient from "./components/Ambient";
import SignIn from "./components/SignIn";
import Workspace from "./components/Workspace";

// The kiosk screen lives at /ambient; everything else is the normal app.
const isAmbient = window.location.pathname.replace(/\/+$/, "") === "/ambient";

export default function App() {
  const [user, setUser] = useState(null);
  // If a token is saved from last time, check it with the server before showing anything.
  const [checking, setChecking] = useState(() => Boolean(localStorage.getItem("token")));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    apiFetch("/api/me")
      .then((data) => setUser(data.username))
      .catch((err) => {
        if (err.status === 401) localStorage.removeItem("token");
      })
      .finally(() => setChecking(false));
  }, []);

  const handleSignedIn = useCallback((data) => {
    localStorage.setItem("token", data.token);
    setUser(data.username);
  }, []);

  const handleSignOut = useCallback(() => {
    // apiFetch reads the token before the request goes out, so it's safe to clear it right after.
    apiFetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  if (checking) {
    return (
      <div className="splash">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <SignIn onSignedIn={handleSignedIn} />;
  if (isAmbient) return <Ambient onSignOut={handleSignOut} />;
  return <Workspace username={user} onSignOut={handleSignOut} />;
}
