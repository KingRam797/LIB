# Mmm! theme — brand overlay for a Dawn fork

This directory is not a complete Shopify theme. It's the **Mmm! brand system and custom
sections**, designed to drop into a fork of [Shopify Dawn](https://github.com/Shopify/dawn)
(per build plan Phase 1: "Shopify theme fork (Dawn base) → apply brand tokens").

Keeping only our delta in the repo keeps the diff meaningful — Dawn's ~300 stock files
would drown our 8.

## How to assemble the working theme

1. `shopify theme init mmm-theme --clone-url https://github.com/Shopify/dawn` (or fork Dawn
   in the Shopify admin).
2. Copy this directory's contents over the fork:
   - `assets/mmm-brand.css` → `assets/` — then include it in `layout/theme.liquid`
     **after** `base.css`:
     `{{ 'mmm-brand.css' | asset_url | stylesheet_tag }}`
   - `sections/*.liquid` → `sections/`
   - `snippets/*.liquid` → `snippets/`
3. Load the brand fonts in `layout/theme.liquid` `<head>` (Fraunces + Hanken Grotesk,
   Google Fonts):
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Hanken+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
   ```
4. Add `{% render 'mmm-disclaimer' %}` to the product template (`main-product` section or
   `templates/product.json`) so the DSHEA disclaimer renders on **every PDP** — this is a
   Phase 1 acceptance requirement, not a nice-to-have.
5. `shopify theme dev` to preview; `shopify theme push` when King approves.

## What's here

| Path | What it is |
|---|---|
| `config/tokens.json` | Design tokens — palette, type, spacing. Source of truth. |
| `assets/mmm-brand.css` | Tokens as CSS custom properties + base components (buttons, cards, fine print). |
| `sections/mmm-hero.liquid` | Homepage hero (customizer-editable, claims-safe defaults). |
| `sections/mmm-ritual-steps.liquid` | Quiz → stack → ritual three-step story block. |
| `sections/quiz.liquid` | Phase 2 placeholder (email teaser) — real quiz UI lands in Phase 2. |
| `snippets/mmm-product-card.liquid` | Reusable product card with per-SKU accent. |
| `snippets/mmm-subscription-toggle.liquid` | Subscribe-first purchase toggle (ReCharge selling plans). |
| `snippets/mmm-disclaimer.liquid` | DSHEA disclaimer partial. Compliance-critical. |

## Rules

- Visual changes start in `config/tokens.json`, then mirror into `mmm-brand.css`.
- Any copy edited in the customizer must stay structure/function-safe (see
  `../engine/narrative-library/research/market-analysis.md` §3 for the
  prohibited→compliant table).
- The subscription toggle must keep Subscribe as the default-checked, visually primary
  option (build principle #2).
