"use client";

import { use, useState } from "react";
import { api } from "../../../lib/api";
import { button, useApi, useRequiredSession } from "../../../lib/ui";

interface Lesson {
  slug: string;
  title: string;
  bodyMd: string;
  completed: boolean;
}

/** Minimal markdown rendering (headings, bold, lists) — no external deps. */
function renderMd(md: string) {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
    if (/^\d+\. /.test(line) || line.startsWith("- ")) {
      return <li key={i}>{inline(line.replace(/^(\d+\. |- )/, ""))}</li>;
    }
    if (line.trim() === "") return null;
    return <p key={i}>{inline(line)}</p>;
  });
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const session = useRequiredSession();
  const { data, reload } = useApi<{ lesson: Lesson }>(`/lessons/${slug}`);
  const [busy, setBusy] = useState(false);

  if (!data) return <main>Loading…</main>;
  const { lesson } = data;

  return (
    <main>
      <a href="/lessons" style={{ color: "#3ecf8e" }}>← All lessons</a>
      <article>{renderMd(lesson.bodyMd)}</article>
      {lesson.completed ? (
        <p style={{ color: "#3ecf8e" }}>✅ Completed</p>
      ) : (
        <button
          style={button}
          disabled={busy}
          onClick={async () => {
            if (!session) return;
            setBusy(true);
            await api(`/lessons/${slug}/complete`, { method: "POST", token: session.accessToken });
            reload();
            setBusy(false);
          }}
        >
          Mark complete
        </button>
      )}
    </main>
  );
}
