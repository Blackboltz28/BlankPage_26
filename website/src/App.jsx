import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import Ambient from "./components/Ambient";
import Kiosk from "./components/Kiosk";
import SignIn from "./components/SignIn";
import Workspace from "./components/Workspace";

// /kiosk: the shared screen (no sign-in). /ambient: your own full-screen view. Anything else: the app.
const page = window.location.pathname.replace(/\/+$/, "");

export default function App() {
  return page === "/kiosk" ? <Kiosk /> : <SignedInApp />;
}

function SignedInApp() {
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
  if (page === "/ambient") return <Ambient onSignOut={handleSignOut} />;
  return <Workspace username={user} onSignOut={handleSignOut} />;
}
