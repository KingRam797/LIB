# LIB
LIB is an intelligent, expressive AI-powered chat assistant designed to automate workflows, manage creative tasks, and speak like a fashion-forward strategist with a coder’s brain.

## Environment keys (Mmm! site)

Copy `.env.example` to `.env.local` in this repo root and fill in real values —
`.env.local` is gitignored and must never be committed. Locally, the code finds
it automatically via `mmm/integrations/env.ts` (`loadEnvLocal` walks up from
wherever you run to this root). For the live site, set the same variable names
in **Vercel → Project → Settings → Environment Variables** and redeploy.

| Key | Phase | Used by |
|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | 1 (required) | `mmm/integrations/shopify.ts` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | 1 (required) | `mmm/integrations/shopify.ts` |
| `KLAVIYO_PRIVATE_KEY` | 2 (optional) | `mmm/integrations/klaviyo.ts` — server-side only |
| `RECHARGE_API_TOKEN` | 2 (optional) | `mmm/integrations/recharge.ts` — server-side only |

One call gets everything, validated: `mmmEnv()` from `mmm/integrations/env.ts`.
