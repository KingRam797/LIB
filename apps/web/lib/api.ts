"use client";

import type { AuthTokens, PublicUser } from "@spendwhere/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Session extends AuthTokens {
  user: PublicUser;
}

export function saveSession(session: Session): void {
  sessionStorage.setItem("spendwhere.session", JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem("spendwhere.session");
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function clearSession(): void {
  sessionStorage.removeItem("spendwhere.session");
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json;
}
