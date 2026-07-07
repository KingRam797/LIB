"use client";

import { useEffect, useState } from "react";
import { api, loadSession } from "../../lib/api";
import { button, card, ghostButton, input, Notice, useRequiredSession } from "../../lib/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface NameCheck {
  formatIssues: string[];
  distinguishableName: string;
  searches: { laraEntitySearch: string; usptoTrademarkSearch: string };
  disclaimer: string;
}

interface ProfileResponse {
  profile: Record<string, unknown> | null;
  readiness: { articlesMissingFields: string[] };
}

const FIELDS: Array<[key: string, label: string]> = [
  ["entityName", "LLC name (must end in LLC / L.L.C.)"],
  ["residentAgentName", "Resident agent name"],
  ["registeredOfficeStreet", "Registered office street (Michigan)"],
  ["registeredOfficeCity", "Registered office city"],
  ["registeredOfficeZip", "Registered office ZIP"],
  ["organizerName", "Organizer name (you)"],
  ["organizerAddress", "Organizer address"],
  ["responsiblePartyName", "EIN responsible party"],
  ["principalActivity", "Principal business activity"],
  ["businessStartDate", "Business start date (YYYY-MM-DD)"],
];

export default function LlcPage() {
  const session = useRequiredSession();
  const [form, setForm] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<string[]>([]);
  const [nameToCheck, setNameToCheck] = useState("");
  const [check, setCheck] = useState<NameCheck | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    api<ProfileResponse>("/llc/profile", { token: session.accessToken }).then((res) => {
      if (res.profile) {
        const next: Record<string, string> = {};
        for (const [key] of FIELDS) {
          const v = res.profile[key];
          if (typeof v === "string") next[key] = v;
        }
        setForm(next);
      }
      setReadiness(res.readiness.articlesMissingFields);
    });
  }, [session]);

  async function save() {
    if (!session) return;
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value) body[key] = value;
    }
    const res = await api<ProfileResponse>("/llc/profile", {
      method: "PUT",
      token: session.accessToken,
      body,
    });
    setReadiness(res.readiness.articlesMissingFields);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function download(path: string, filename: string) {
    const s = loadSession();
    if (!s) return;
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${s.accessToken}` },
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string; missingFields?: string[] };
      alert(err.error + (err.missingFields ? `: ${err.missingFields.join(", ")}` : ""));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session) return <main>Loading…</main>;

  return (
    <main>
      <h1>LLC formation toolkit (Michigan)</h1>
      <Notice>
        SpendWHERE generates documents for you to review and file yourself with LARA
        ($50 filing fee) and the IRS. Not legal advice.
      </Notice>

      <div style={card}>
        <h2>1. Check your business name</h2>
        <input style={input} placeholder="e.g. Golden Basket Media LLC" value={nameToCheck} onChange={(e) => setNameToCheck(e.target.value)} />
        <button
          style={button}
          disabled={!nameToCheck}
          onClick={async () => {
            const result = await api<NameCheck>("/llc/name-check", {
              method: "POST",
              token: session.accessToken,
              body: { name: nameToCheck },
            });
            setCheck(result);
          }}
        >
          Check format
        </button>
        {check && (
          <div style={{ marginTop: "1rem" }}>
            {check.formatIssues.length === 0 ? (
              <p style={{ color: "#3ecf8e" }}>✓ Format looks good.</p>
            ) : (
              check.formatIssues.map((issue) => <p key={issue} style={{ color: "#ff8080" }}>⚠ {issue}</p>)
            )}
            <p>
              Now confirm availability:{" "}
              <a style={{ color: "#3ecf8e" }} href={check.searches.laraEntitySearch} target="_blank" rel="noreferrer">LARA entity search</a>
              {" · "}
              <a style={{ color: "#3ecf8e" }} href={check.searches.usptoTrademarkSearch} target="_blank" rel="noreferrer">USPTO trademark search</a>
            </p>
            <p style={{ fontSize: "0.8rem", color: "#9db8ab" }}>{check.disclaimer}</p>
          </div>
        )}
      </div>

      <div style={card}>
        <h2>2. Your LLC details</h2>
        {FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              style={input}
              value={form[key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button style={button} onClick={() => void save()}>
          {saved ? "Saved ✓" : "Save details"}
        </button>
        {readiness.length > 0 && (
          <p style={{ color: "#ffd27f", marginTop: "0.6rem" }}>
            Still needed for Articles: {readiness.join(", ")}
          </p>
        )}
      </div>

      <div style={card}>
        <h2>3. Generate your documents</h2>
        <p style={{ color: "#9db8ab" }}>Each PDF includes filing instructions and a legal disclaimer.</p>
        <button style={{ ...ghostButton, marginRight: "0.5rem", marginBottom: "0.5rem" }} onClick={() => void download("/llc/documents/articles.pdf", "articles-of-organization-mi.pdf")}>
          Articles of Organization
        </button>
        <button style={{ ...ghostButton, marginRight: "0.5rem", marginBottom: "0.5rem" }} onClick={() => void download("/llc/documents/operating-agreement.pdf", "operating-agreement.pdf")}>
          Operating Agreement
        </button>
        <button style={{ ...ghostButton, marginRight: "0.5rem", marginBottom: "0.5rem" }} onClick={() => void download("/llc/documents/resident-agent-guide.pdf", "resident-agent-guide.pdf")}>
          Resident Agent Guide
        </button>
        <button style={{ ...ghostButton, marginBottom: "0.5rem" }} onClick={() => void download("/llc/documents/ss4-summary.pdf", "ein-ss4-prepared-answers.pdf")}>
          EIN (SS-4) Prepared Answers
        </button>
      </div>
    </main>
  );
}
