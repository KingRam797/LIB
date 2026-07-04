# Personalization Engine — PHASE 2 (the real software)

Everything else in this repo is configuration around this directory. Build it well;
the rest is plumbing.

## What lands here in Phase 2

| File | What it is |
|---|---|
| `rules.ts` | Deterministic profile → stack → doses. Pure function, fully unit-tested. MMM always the base; goals map to add-ons (stress/sleep → AAH; heart/brain/mood or vegan → OOO; joints → TASTY). Returns `{ stack, doses, rationaleKeys }`. |
| `dosing.ts` | Class A/B nutrient table + **ceiling guard**: any dose exceeding its class ceiling **throws** — never silently caps into an unsafe range. Class A (storage-limited) ~50% RDA, ceiling enforced; Class B (self-regulating) at/above RDA. |
| `narrative-library/` | Pre-generated copy pipeline (§5A). `research/` grounding is compiled ✅; `generate.ts`, `library.json`, `library.test.ts` land in Phase 2. |
| `engine.test.ts` | Dose-ceiling + rules assertions. |

## Non-negotiables (carry these into every file)

1. **The dose is always deterministic. The LLM never sets it.** Narrative copy is
   generated at build time, reviewed by King, committed — never at request time.
2. **Doses require King's sign-off.** Actual per-nutrient values must match the Supliful
   label actives King confirms in the Phase 1 [CONFIG] pass. Do not assume a dose
   (plan §0: "Ask before assuming a dose, a claim, or a price").
3. **No medical records.** `HealthProfile` stores preferences and goals, never diagnoses.
4. **Every stored narrative passes the no-claims test** — asserted across the whole
   library (`library.test.ts`), not per-request.

## Grounding (already compiled)

- `narrative-library/research/market-analysis.md` — buyer motivations, objections, and
  voice-of-customer language per goal segment; DSHEA/FTC prohibited→compliant table.
- `narrative-library/research/personalization-research.md` — framings that convert,
  churn/retention benchmarks, habit-formation science, lifecycle flow specs,
  voice-pillar (respect/return/ritual) mapping.
