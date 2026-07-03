"use client";

import { useEffect, useState } from "react";
import type { PublicUser } from "@spendwhere/shared";
import { api, clearSession, loadSession } from "../../lib/api";

interface KycStartResponse {
  inquiryId: string;
  sessionUrl: string | null;
  stub: boolean;
}

export default function DashboardPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    api<{ user: PublicUser }>("/me", { token: session.accessToken })
      .then((res) => setUser(res.user))
      .catch(() => {
        clearSession();
        window.location.href = "/login";
      });
  }, []);

  async function startKyc() {
    const session = loadSession();
    if (!session) return;
    try {
      const res = await api<KycStartResponse>("/kyc/start", {
        method: "POST",
        token: session.accessToken,
      });
      if (res.sessionUrl) {
        window.location.href = res.sessionUrl;
      } else {
        setNotice(
          `Verification started (inquiry ${res.inquiryId}). Sandbox mode: ask an admin to complete it.`,
        );
      }
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  if (!user) return <main>Loading…</main>;

  const kycBadge: Record<string, string> = {
    not_started: "⚪ Not started",
    pending: "🟡 Pending",
    passed: "🟢 Verified",
    failed: "🔴 Failed",
  };

  return (
    <main>
      <h1>Welcome, {user.displayName}</h1>
      <p>
        Identity verification: <strong>{kycBadge[user.kycStatus]}</strong>
      </p>
      {user.kycStatus !== "passed" && (
        <button
          onClick={startKyc}
          style={{ padding: "0.6rem 1.4rem", borderRadius: 6, border: 0, background: "#3ecf8e", color: "#0b1410", fontWeight: 700 }}
        >
          {user.kycStatus === "pending" ? "Continue verification" : "Verify my identity"}
        </button>
      )}
      {notice && <p style={{ color: "#ffd27f" }}>{notice}</p>}
      <p style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#9db8ab" }}>
        MFA: {user.mfaEnabled ? "enabled" : "not enabled"} · {user.email}
      </p>
      <button
        onClick={() => {
          clearSession();
          window.location.href = "/";
        }}
        style={{ marginTop: "1rem", padding: "0.4rem 1rem", borderRadius: 6, border: "1px solid #2a4a3a", background: "transparent", color: "#9db8ab" }}
      >
        Sign out
      </button>
    </main>
  );
}
