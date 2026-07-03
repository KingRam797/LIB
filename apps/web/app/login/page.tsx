"use client";

import { useState } from "react";
import { api, saveSession, type Session } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: { email, password, ...(totpCode ? { totpCode } : {}) },
      });
      saveSession(session);
      window.location.href = "/dashboard";
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("TOTP")) setMfaRequired(true);
      setError(message);
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
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mfaRequired && (
          <label>
            Authenticator code
            <input style={input} inputMode="numeric" pattern="\d{6}" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
          </label>
        )}
        {error && <p style={{ color: "#ff8080" }}>{error}</p>}
        <button
          disabled={busy}
          style={{ padding: "0.6rem 1.4rem", borderRadius: 6, border: 0, background: "#3ecf8e", color: "#0b1410", fontWeight: 700 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
