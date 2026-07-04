"use client";

import { useState } from "react";
import { api } from "../../lib/api";
import { button, card, dollars, ghostButton, input, Notice, useApi, useRequiredSession } from "../../lib/ui";

interface Schedule {
  id: string;
  name: string;
  cadence: string;
  amountCents: number;
  target: string;
  startsOn: string;
  active: boolean;
}

export default function InvestPage() {
  const session = useRequiredSession();
  const { data, reload } = useApi<{ schedules: Schedule[]; notice: string }>("/invest/schedules");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [amount, setAmount] = useState("100");
  const [target, setTarget] = useState("index_fund");
  const [startsOn, setStartsOn] = useState("");

  if (!data) return <main>Loading…</main>;

  return (
    <main>
      <h1>Investment schedules</h1>
      <Notice>{data.notice}</Notice>

      {data.schedules.map((s) => (
        <div key={s.id} style={card}>
          <strong>{s.active ? "🟢" : "⏸️"} {s.name}</strong>
          <p style={{ color: "#9db8ab", margin: "0.3rem 0" }}>
            {dollars(s.amountCents)} {s.cadence} → {s.target.replaceAll("_", " ")} (from {s.startsOn})
          </p>
          <button
            style={ghostButton}
            onClick={async () => {
              if (!session) return;
              await api(`/invest/schedules/${s.id}`, {
                method: "PATCH",
                token: session.accessToken,
                body: { active: !s.active },
              });
              reload();
            }}
          >
            {s.active ? "Pause" : "Resume"}
          </button>{" "}
          <button
            style={ghostButton}
            onClick={async () => {
              if (!session) return;
              await api(`/invest/schedules/${s.id}`, { method: "DELETE", token: session.accessToken });
              reload();
            }}
          >
            Delete
          </button>
        </div>
      ))}

      <h2>New schedule</h2>
      <input style={input} placeholder="Name (e.g. Monthly index fund)" value={name} onChange={(e) => setName(e.target.value)} />
      <select style={input} value={cadence} onChange={(e) => setCadence(e.target.value)}>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Every two weeks</option>
        <option value="monthly">Monthly</option>
      </select>
      <input style={input} type="number" min="1" step="1" placeholder="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select style={input} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="emergency_fund">Emergency fund</option>
        <option value="index_fund">Index fund</option>
        <option value="retirement">Retirement</option>
        <option value="real_estate">Real estate</option>
        <option value="custom">Custom</option>
      </select>
      <input style={input} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      <button
        style={button}
        disabled={!name || !startsOn || Number(amount) <= 0}
        onClick={async () => {
          if (!session) return;
          await api("/invest/schedules", {
            method: "POST",
            token: session.accessToken,
            body: {
              name,
              cadence,
              amountCents: Math.round(Number(amount) * 100),
              target,
              startsOn,
            },
          });
          setName("");
          reload();
        }}
      >
        Add schedule
      </button>
    </main>
  );
}
