# Mmm! — Working Memory (condensed build plan)

Product: Morning Motion Multivitamin (mmm.co) · Division: PainOrPane Products
Executor: Claw (Fable, in Claude Code) · Anchor: Luke 14:28 — count the cost before you build.

One line: An AI-personalized daily vitamin ritual — a quiz turns each person's goals into a
right-dosed stack, sold subscription-first, fulfilled hands-off.

## Lanes

- **[CODE]** — built by Claw in this repo.
- **[CONFIG]** — executed by King in SaaS dashboards (Shopify, Supliful, ReCharge, ShipBob,
  Klaviyo). Claw prepares exact specs/checklists in `config-checklists/`.

Work phase by phase. Do not start a phase until the prior phase's Acceptance block passes.
Ask before assuming a dose, a claim, or a price.

## Product truth

| SKU   | Name  | Actives             | Role                      |
|-------|-------|---------------------|---------------------------|
| MMM   | Mmm   | Multivitamin base   | Everyone's floor          |
| OOO   | Ooo   | Omega-3             | Heart / brain / mood      |
| AAH   | Aah   | Ashwagandha         | Stress / sleep / recovery |
| TASTY | Tasty | Turmeric            | Inflammation / joints     |

**Dosing framework — a safety rule, not a preference:**

- **Class A — storage-limited (~50% RDA).** Nutrients the body accumulates (fat-soluble
  vitamins, certain minerals). Dose conservatively. Ceiling enforced.
- **Class B — self-regulating (100%+ RDA).** Water-soluble nutrients the body clears.
  Safe at or above RDA.

Every recommendation resolves doses through this table. The dose is always deterministic.
**The LLM never sets it.**

## Brand

- Voice pillars: **respect, return, ritual.** Warm, brief, no hype, no fear-selling.
- Palette: sunrise orange, fresh green, soft violet, warm white (`theme/config/tokens.json`).
- Type: Fraunces (serif, display) / Hanken Grotesk (body).
- Domain: mmm.co

## Stack (chosen)

Shopify (storefront) · Supliful (white-label POD product + fulfillment through launch) ·
ReCharge (subscriptions) · ShipBob (only if the 100-bottle pivot means holding inventory) ·
Klaviyo (lifecycle email/SMS) · SEMrush / Search Console / GBP (SEO).

## Build principles (non-negotiable)

1. **Deterministic dosing.** Doses come from the rules table + Class A/B ceilings. The LLM
   writes *around* the recommendation, never the recommendation.
2. **Subscription-first.** Default CTA is subscribe; one-time exists but is never featured.
3. **Margin discipline.** No offer ships that isn't margin-positive after Supliful COGS +
   Shopify/ReCharge fees. Launch offer: "Grab a round, keep one around" (§5B). Never open BOGO.
4. **Voice consistency.** Every string passes the respect/return/ritual test.
5. **Compliance by default.** DSHEA disclaimer on every product + recommendation surface.
   No disease claims. Ever.

## Phases & status

- **PHASE 1 — FOUNDATION** — *[CODE] built; awaiting King's [CONFIG] pass*
  - [CODE] repo scaffold ✅ · brand tokens ✅ · Liquid sections (hero, product card,
    ritual/steps, subscription toggle, DSHEA partial) ✅ · Storefront client + typed
    product schema ✅
  - [CONFIG] → `config-checklists/phase-1-foundation.md`
  - Acceptance: store live at mmm.co, four SKUs purchasable one-time + 30-day
    subscription, brand applied, disclaimer on every PDP.
- **PHASE 2 — PERSONALIZATION ENGINE** — quiz → rules engine → narrative binding →
  prefilled cart. Research grounding compiled ✅ (`engine/narrative-library/research/`).
  Quiz question set LOCKED (6 questions, config-swappable — `quiz/config/set-6.json`).
- **PHASE 3 — SUBSCRIPTION · FULFILLMENT · LIFECYCLE** — Klaviyo flows, webhooks.
- **PHASE 4 — GROWTH & OPS** — SEO goal pages, ops routines, referral, dashboard.

## Compliance guardrails (§6)

- DSHEA disclaimer on every PDP, quiz result, and email footer:
  *"These statements have not been evaluated by the Food and Drug Administration. This
  product is not intended to diagnose, treat, cure, or prevent any disease."*
- Structure/function claims only ("supports focus," "helps maintain calm"). No disease
  claims ("treats anxiety," "prevents heart disease") — anywhere, including LLM output.
- Every recommendation carries: "not a substitute for professional advice; talk to your
  provider if you're pregnant, on medication, or managing a condition."
- Medication/sensitivity quiz flag → gentler, provider-first result copy.
- Prohibited→compliant rewrite table lives in
  `engine/narrative-library/research/market-analysis.md` §3.

## The offer — "Grab a round, keep one around" (§5B)

New subscribers only, subscription purchase required, once per subscriber:
- Round 1 (month 1): free shipping on the first bottle. (Acquisition.)
- Round 2 (month 2): free third bottle bundled into the second subscription order —
  rides the paid shipment, zero incremental shipping, margin already recouped.
  (Retention + habit: stock on the shelf keeps the ritual.)

## Resolved decisions

1. **Fulfillment:** Supliful POD through launch. At **100 bottles/month**: convene on
   custom-label/custom-formula pivot; ShipBob only if that means holding inventory.
2. **Quiz depth:** launch 6 questions, config-swappable; A/B 6 vs 10 at the 100-bottle
   milestone.
3. **Narrative:** pre-generated per archetype (token discipline); build-time pipeline in
   `engine/narrative-library/`, reviewed by King, committed. Never at request time.
4. **Offer:** "Grab a round, keep one around."

## Definition of done

1. Quiz → safe personalized stack → subscription, end to end, for a cold visitor.
2. Every dose passes the Class A/B ceiling test; every generated string passes the
   no-claims test.
3. Subscriber acquired, charged, fulfilled, reminded, won back — King not in the loop.
4. One command → daily ops brief; dashboard shows MRR, active subs, churn, LTV,
   quiz→subscribe conversion.
5. Unit economics margin-positive before a dollar of ad spend.

Count the cost. Then build the ritual.
