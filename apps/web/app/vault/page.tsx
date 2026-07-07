"use client";

import { useState } from "react";
import { api, loadSession } from "../../lib/api";
import { button, card, ghostButton, input, Notice, useApi, useRequiredSession } from "../../lib/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CATEGORIES = [
  ["articles", "Articles of Organization"],
  ["ein_letter", "EIN letter"],
  ["operating_agreement", "Operating agreement"],
  ["tax", "Tax document"],
  ["identity", "Identity document"],
  ["other", "Other"],
] as const;

interface VaultDoc {
  id: string;
  filename: string;
  sizeBytes: number;
  category: string;
  tags: string[];
  createdAt: string;
}

export default function VaultPage() {
  const session = useRequiredSession();
  const [query, setQuery] = useState("");
  const { data, reload } = useApi<{ documents: VaultDoc[] }>(
    `/vault/documents${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    [query],
  );
  const [category, setCategory] = useState("other");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!session || !file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      await api("/vault/documents", {
        method: "POST",
        token: session.accessToken,
        body: {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          category,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          dataBase64: btoa(binary),
        },
      });
      setFile(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(doc: VaultDoc) {
    const s = loadSession();
    if (!s) return;
    const res = await fetch(`${API_BASE}/vault/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${s.accessToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session) return <main>Loading…</main>;

  return (
    <main>
      <h1>Document vault</h1>
      <Notice>
        Files are encrypted with AES-256 before they touch storage — only you can
        open them through your account.
      </Notice>

      <div style={card}>
        <h2>Upload</h2>
        <input style={input} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <select style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input style={input} placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        {error && <p style={{ color: "#ff8080" }}>{error}</p>}
        <button style={button} disabled={!file || busy} onClick={() => void upload()}>
          {busy ? "Encrypting & uploading…" : "Upload"}
        </button>
      </div>

      <h2>Your documents</h2>
      <input style={input} placeholder="Search filename or tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {(data?.documents ?? []).map((doc) => (
        <div key={doc.id} style={card}>
          <strong>🔒 {doc.filename}</strong>
          <p style={{ color: "#9db8ab", margin: "0.3rem 0" }}>
            {CATEGORIES.find(([v]) => v === doc.category)?.[1] ?? doc.category} ·{" "}
            {(doc.sizeBytes / 1024).toFixed(1)} KB
            {doc.tags.length > 0 && <> · {doc.tags.join(", ")}</>}
          </p>
          <button style={ghostButton} onClick={() => void download(doc)}>Download</button>{" "}
          <button
            style={ghostButton}
            onClick={async () => {
              if (!session || !confirm(`Delete ${doc.filename}?`)) return;
              await api(`/vault/documents/${doc.id}`, { method: "DELETE", token: session.accessToken });
              reload();
            }}
          >
            Delete
          </button>
        </div>
      ))}
      {data && data.documents.length === 0 && <p style={{ color: "#9db8ab" }}>No documents yet.</p>}
    </main>
  );
}
