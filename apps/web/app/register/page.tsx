"use client";

import { useState } from "react";
import { api, saveSession, type Session } from "../../lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<Session>("/auth/register", {
        method: "POST",
        body: { email, password, displayName },
      });
      saveSession(session);
      window.location.href = "/dashboard";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = {
    display: "block",
    width: "100%",
    padding: "0.6rem",
    marginBottom: "1rem",
    borderRadius: 6,
    border: "1px solid #2a4a3a",
    background: "#12201a",
    color: "#e8f5ee",
  } as const;

  return (
    <main>
      <h1>Create your account</h1>
      <form onSubmit={submit}>
        <label>
          Display name
          <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label>
          Email
          <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password (12+ characters)
          <input style={input} type="password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p style={{ color: "#ff8080" }}>{error}</p>}
        <button
          disabled={busy}
          style={{ padding: "0.6rem 1.4rem", borderRadius: 6, border: 0, background: "#3ecf8e", color: "#0b1410", fontWeight: 700 }}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
