# Higgsfield Asset Generation Queue

Claude generates every visual through the Higgsfield MCP, then saves to `client/public/assets/`
under the exact filenames the components reference. Global aesthetic across ALL prompts:

> Editorial, cinematic, high-end fashion/streetwear energy. Cream (#F7F3EC) and espresso
> (#3E2F25 → #8A7259) palette. Warm film grain, soft directional light, shallow depth of field.
> Typographic sensibility of Cormorant Garamond + Plus Jakarta Sans. No text baked into images.
> No logos. Quiet luxury, not corporate dashboard.

Generate in this order:

1. **hero-counting-house.mp4** — "Cinematic 6-second loop: slow dolly across a sunlit atelier / counting-house desk, ledgers, brass, espresso and cream tones, dust motes in a shaft of light, editorial fashion-film grade, shallow focus, no text." Also export first frame as **hero-poster.jpg**.
2. **factcard-bg.jpg** — "Abstract editorial texture: cream paper meets espresso ink wash, subtle gold leaf fleck, luxury magazine spread background, soft grain, generous negative space for overlaid text."
3. **icon-respect.svg** — "Minimal line icon, single espresso stroke on transparent: an open hand lifting — 'respect'. Editorial, thin elegant line, no fill."
4. **icon-return.svg** — "Minimal line icon, espresso stroke: a circular arrow / sunrise loop — 'return'. Thin elegant line."
5. **icon-ritual.svg** — "Minimal line icon, espresso stroke: a lit candle / repeated marks — 'ritual'. Thin elegant line."
6. **pursuit-badges.png** (sprite) — "Eight small editorial emblems in gold-on-cream for pursuits: multivitamin, fintech, voice waveform, XRP coin, house key, LinkedIn 'in', graduation cap, hourglass. Consistent thin-line luxury style."
7. **dashboard-texture.jpg** — "Faint cream linen texture with espresso vignette, subtle, for card backgrounds. Barely-there, luxury stationery."
8. **fitness-hero.jpg** — "Editorial athletic portrait energy: dumbbell and chalk on espresso concrete, warm rim light, streetwear-meets-gym aesthetic, cream tones, cinematic, no faces."

## Placeholder status (Phase 3)

Placeholder files currently occupy every slot above in `client/public/assets/` so the UI
renders without broken references. Each placeholder is palette-matched (cream/espresso/gold)
and named exactly as the components expect. Replace each file in place with the real
Higgsfield generation — no code changes needed.
