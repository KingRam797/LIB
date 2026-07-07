"use client";

import { useState } from "react";
import { api } from "../../lib/api";
import { button, card, dollars, input, useApi, useRequiredSession } from "../../lib/ui";

const CATEGORIES = [
  "income", "housing", "food", "transportation", "business",
  "healthcare", "taxes", "savings", "entertainment", "other",
] as const;

interface Summary {
  incomeCents: number;
  spendCents: number;
  netCents: number;
  spendByCategory: Record<string, number>;
  tax: { rate: number; suggestedSetAsideCents: number; setAsideSoFarCents: number; gapCents: number; note: string };
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function BudgetPage() {
  const session = useRequiredSession();
  const [month, setMonth] = useState(currentMonth());
  const { data: summary, reload } = useApi<Summary>(`/budget/summary?month=${month}`, [month]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("income");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <main>
      <h1>Budget & tax</h1>
      <input style={input} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

      {summary && (
        <>
          <div style={card}>
            <p>Income: <strong>{dollars(summary.incomeCents)}</strong></p>
            <p>Spend: <strong>{dollars(summary.spendCents)}</strong></p>
            <p>Net: <strong>{dollars(summary.netCents)}</strong></p>
          </div>
          <div style={card}>
            <strong>Spend by category</strong>
            {Object.entries(summary.spendByCategory).map(([cat, cents]) => (
              <p key={cat} style={{ margin: "0.3rem 0", color: "#9db8ab" }}>
                {cat}: {dollars(cents)}
              </p>
            ))}
            {Object.keys(summary.spendByCategory).length === 0 && (
              <p style={{ color: "#9db8ab" }}>No spending recorded this month.</p>
            )}
          </div>
          <div style={card}>
            <strong>Tax set-aside ({Math.round(summary.tax.rate * 100)}% guideline)</strong>
            <p style={{ margin: "0.3rem 0", color: "#9db8ab" }}>
              Suggested: {dollars(summary.tax.suggestedSetAsideCents)} · Set aside so far:{" "}
              {dollars(summary.tax.setAsideSoFarCents)} · Gap:{" "}
              <strong style={{ color: summary.tax.gapCents > 0 ? "#ffd27f" : "#3ecf8e" }}>
                {dollars(summary.tax.gapCents)}
              </strong>
            </p>
            <p style={{ fontSize: "0.8rem", color: "#9db8ab" }}>{summary.tax.note}</p>
          </div>
        </>
      )}

      <h2>Add a transaction</h2>
      <input style={input} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input
        style={input}
        type="number"
        step="0.01"
        placeholder="Amount in USD (positive = income, negative = spend)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button
        style={button}
        disabled={!description || !amount || Number(amount) === 0}
        onClick={async () => {
          if (!session) return;
          await api("/budget/transactions", {
            method: "POST",
            token: session.accessToken,
            body: {
              transactions: [
                {
                  occurredOn: date,
                  description,
                  amountCents: Math.round(Number(amount) * 100),
                  category,
                },
              ],
            },
          });
          setDescription("");
          setAmount("");
          reload();
        }}
      >
        Add
      </button>
    </main>
  );
}
