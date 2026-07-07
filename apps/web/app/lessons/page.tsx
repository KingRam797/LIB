"use client";

import { card, useApi } from "../../lib/ui";

interface LessonListItem {
  slug: string;
  title: string;
  summary: string;
  completed: boolean;
}

export default function LessonsPage() {
  const { data } = useApi<{ lessons: LessonListItem[] }>("/lessons");
  if (!data) return <main>Loading…</main>;

  return (
    <main>
      <h1>Financial literacy</h1>
      <p style={{ color: "#9db8ab" }}>
        Short lessons built for non-W2 earners. Educational content, not financial advice.
      </p>
      {data.lessons.map((lesson) => (
        <a key={lesson.slug} href={`/lessons/${lesson.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div style={card}>
            <strong>{lesson.completed ? "✅ " : "📘 "}{lesson.title}</strong>
            <p style={{ color: "#9db8ab", margin: "0.4rem 0 0" }}>{lesson.summary}</p>
          </div>
        </a>
      ))}
    </main>
  );
}
