"use client";

import { api } from "../../lib/api";
import { card, ghostButton, Notice, useApi, useRequiredSession } from "../../lib/ui";

interface ComplianceEvent {
  id: string;
  kind: string;
  title: string;
  description: string;
  dueOn: string;
  completedAt: string | null;
}

interface RemindersResponse {
  notifications: { id: string; message: string; firedAt: string }[];
}

export default function CalendarPage() {
  const session = useRequiredSession();
  const { data: eventsData, reload } = useApi<{ events: ComplianceEvent[] }>("/calendar/events");
  const { data: reminders } = useApi<RemindersResponse>("/calendar/reminders?withinDays=60");

  if (!eventsData) return <main>Loading…</main>;
  const open = eventsData.events.filter((e) => !e.completedAt);
  const done = eventsData.events.filter((e) => e.completedAt);

  return (
    <main>
      <h1>Compliance calendar</h1>
      {(reminders?.notifications.length ?? 0) > 0 && (
        <Notice>
          {reminders!.notifications.map((n) => (
            <span key={n.id} style={{ display: "block" }}>🔔 {n.message}</span>
          ))}
        </Notice>
      )}
      {open.length === 0 && (
        <p style={{ color: "#9db8ab" }}>
          No upcoming deadlines. Record your LLC filing date in the{" "}
          <a href="/llc" style={{ color: "#3ecf8e" }}>LLC toolkit</a> to auto-populate
          Michigan and federal deadlines.
        </p>
      )}
      {open.map((event) => (
        <div key={event.id} style={card}>
          <strong>📅 {event.dueOn} — {event.title}</strong>
          <p style={{ color: "#9db8ab", margin: "0.3rem 0" }}>{event.description}</p>
          <button
            style={ghostButton}
            onClick={async () => {
              if (!session) return;
              await api(`/calendar/events/${event.id}/complete`, {
                method: "POST",
                token: session.accessToken,
              });
              reload();
            }}
          >
            Mark done
          </button>
        </div>
      ))}
      {done.length > 0 && (
        <>
          <h2>Completed</h2>
          {done.map((event) => (
            <p key={event.id} style={{ color: "#9db8ab" }}>✅ {event.dueOn} — {event.title}</p>
          ))}
        </>
      )}
    </main>
  );
}
