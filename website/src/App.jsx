import { useState } from 'react'


const api = "http://localhost:5000";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);  

  async function handleSubmit(e) {
    e.preventDefault();
    
    const res = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username, password
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    localStorage.setItem("token", data.token);
    setUser(data.username);
  }
  async function handleSignUp() {
  const res = await fetch(`${api}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    setError(data.error);
    return;
  }
  alert("Account created! Now click Sign In.");
  }

  if (user) {
    return <h1>Welcome, {user}!</h1>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign in</h1>
      <input placeholder='Username' value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type='password' placeholder='Password' value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type='submit'>Sign In</button>
      <button type="button" onClick={handleSignUp}>Sign Up</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  )
}