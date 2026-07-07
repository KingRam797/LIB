"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { api, loadSession, type Session } from "./api";

export const input: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.6rem",
  marginBottom: "1rem",
  borderRadius: 6,
  border: "1px solid #2a4a3a",
  background: "#12201a",
  color: "#e8f5ee",
};

export const button: CSSProperties = {
  padding: "0.6rem 1.4rem",
  borderRadius: 6,
  border: 0,
  background: "#3ecf8e",
  color: "#0b1410",
  fontWeight: 700,
  cursor: "pointer",
};

export const ghostButton: CSSProperties = {
  padding: "0.4rem 1rem",
  borderRadius: 6,
  border: "1px solid #2a4a3a",
  background: "transparent",
  color: "#9db8ab",
  cursor: "pointer",
};

export const card: CSSProperties = {
  border: "1px solid #2a4a3a",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
  background: "#0f1a14",
};

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: "#ffd27f", fontSize: "0.85rem", border: "1px solid #4a3a1a", borderRadius: 6, padding: "0.6rem" }}>
      {children}
    </p>
  );
}

/** Requires a session; redirects to /login when absent. */
export function useRequiredSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const s = loadSession();
    if (!s) {
      window.location.href = "/login";
      return;
    }
    setSession(s);
  }, []);
  return session;
}

export function useApi<T>(path: string, deps: unknown[] = []): { data: T | null; reload: () => void } {
  const session = useRequiredSession();
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    api<T>(path, { token: session.accessToken })
      .then(setData)
      .catch(() => setData(null));
  }, [session, path, tick, ...deps]);
  return { data, reload: () => setTick((t) => t + 1) };
}

export function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
