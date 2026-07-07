# Mmm! — Morning Motion Multivitamin

An AI-personalized daily vitamin ritual — a quiz turns each person's goals into a
right-dosed stack, sold subscription-first, fulfilled hands-off.

**Start with [`CLAUDE.md`](./CLAUDE.md)** — the condensed build plan and working memory.
Division: PainOrPane Products · Domain: mmm.co · Signal: *Here, We Can Build.*

## Layout

```
mmm/
├── CLAUDE.md                 # condensed build plan — read first
├── theme/                    # Shopify brand overlay for a Dawn fork (see theme/README.md)
├── engine/                   # Phase 2: deterministic rules + dosing + narrative library
│   └── narrative-library/research/   # market + personalization grounding (compiled ✅)
├── quiz/config/set-6.json    # launch quiz — 6 questions, LOCKED, config-swappable
├── integrations/             # Shopify Storefront client (live) + ReCharge/Klaviyo seams
├── ops/                      # Phase 4: daily brief, ROAS, list growth, cart alerts
├── seo/                      # Phase 4: programmatic goal pages
└── config-checklists/        # the [CONFIG] handoffs for King
```

## Develop

```bash
cd mmm
npm install
npm run check   # typecheck + tests
```

## Status

**Phase 1 — Foundation:** [CODE] complete; [CONFIG] with King
(`config-checklists/phase-1-foundation.md`). Phase 2 (personalization engine) starts
when Phase 1 acceptance passes and King pastes back confirmed actives, COGS, and prices.
