"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { button, ghostButton, input, useRequiredSession } from "../../lib/ui";

const PERSONAS = [
  ["gig_worker", "Gig worker (rideshare, delivery, tasks)"],
  ["creator", "Creator (content, music, art)"],
  ["freelancer", "Freelancer / consultant"],
  ["small_business", "Small business owner"],
  ["investor", "Investor"],
  ["other", "Something else"],
] as const;

const BANDS = [
  ["under_30k", "Under $30K"],
  ["30k_75k", "$30K – $75K"],
  ["75k_150k", "$75K – $150K"],
  ["150k_500k", "$150K – $500K"],
  ["500k_1m", "$500K – $1M"],
  ["1m_3m", "$1M – $3M"],
  ["over_3m", "Over $3M"],
] as const;

const GOAL_OPTIONS = [
  "Form an LLC",
  "Get my taxes under control",
  "Build an emergency runway",
  "Start investing consistently",
  "Separate business & personal money",
];

interface Profile {
  persona: string | null;
  incomeBand: string | null;
  goals: string[];
  homeState: string | null;
  currentStep: number;
  completedAt: string | null;
}

export default function OnboardingPage() {
  const session = useRequiredSession();
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState("");
  const [band, setBand] = useState("");
  const [state, setState] = useState("MI");
  const [goals, setGoals] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    api<{ profile: Profile | null }>("/onboarding", { token: session.accessToken }).then((res) => {
      const p = res.profile;
      if (p) {
        if (p.completedAt) {
          window.location.href = "/dashboard";
          return;
        }
        setPersona(p.persona ?? "");
        setBand(p.incomeBand ?? "");
        setState(p.homeState ?? "MI");
        setGoals(p.goals ?? []);
        setStep(p.currentStep);
      }
      setLoaded(true);
    });
  }, [session]);

  async function save(patch: Record<string, unknown>, nextStep: number) {
    if (!session) return;
    await api("/onboarding", {
      method: "PUT",
      token: session.accessToken,
      body: { ...patch, currentStep: nextStep },
    });
    setStep(nextStep);
  }

  if (!session || !loaded) return <main>Loading…</main>;

  return (
    <main>
      <h1>Let&apos;s set you up</h1>
      <p style={{ color: "#9db8ab" }}>Step {step + 1} of 3 — your progress saves automatically.</p>

      {step === 0 && (
        <section>
          <h2>How do you earn?</h2>
          {PERSONAS.map(([value, label]) => (
            <button
              key={value}
              style={{ ...(persona === value ? button : ghostButton), display: "block", width: "100%", marginBottom: "0.5rem", textAlign: "left" }}
              onClick={() => {
                setPersona(value);
                void save({ persona: value }, 1);
              }}
            >
              {label}
            </button>
          ))}
        </section>
      )}

      {step === 1 && (
        <section>
          <h2>Roughly how much do you earn per year?</h2>
          <select style={input} value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">Choose a range…</option>
            {BANDS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label>
            Home state (2 letters)
            <input style={input} maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
          </label>
          <button
            style={button}
            disabled={!band || state.length !== 2}
            onClick={() => void save({ incomeBand: band, homeState: state }, 2)}
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>What do you want to get done?</h2>
          {GOAL_OPTIONS.map((goal) => (
            <button
              key={goal}
              style={{ ...(goals.includes(goal) ? button : ghostButton), display: "block", width: "100%", marginBottom: "0.5rem", textAlign: "left" }}
              onClick={() =>
                setGoals((g) => (g.includes(goal) ? g.filter((x) => x !== goal) : [...g, goal]))
              }
            >
              {goals.includes(goal) ? "✓ " : ""}{goal}
            </button>
          ))}
          <button
            style={{ ...button, marginTop: "1rem" }}
            disabled={goals.length === 0}
            onClick={async () => {
              await save({ goals, completed: true }, 3);
              window.location.href = "/dashboard";
            }}
          >
            Finish
          </button>
        </section>
      )}
    </main>
  );
}
