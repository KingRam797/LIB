# Hosting checklist — Vercel Git integration (Track A)

The deploy model for every PainOrPane project: **GitHub is the deploy button.**
Each repo gets imported into Vercel once; after that, every push auto-deploys and
Claude never needs deploy credentials — Claude's job is keeping each repo
deployable (a `vercel.json` + servable output per repo).

> Verified constraint (2026-07-07): the Claude Code sandbox egress policy blocks
> `vercel.com` / `api.vercel.com` / `api.netlify.com` entirely, and the Vercel MCP
> deploy tool is approval-gated on this surface. Direct deploys from sessions
> require the Track B environment changes at the bottom — until then, Git
> integration is the only working path, and it's also the better one.

## One-time, per repo (King, ~2 minutes each)

1. Make sure the deployable content is on the repo's **default branch**
   (for LIB: merge PR #1 so `mmm/site` + root `vercel.json` land on `main`).
2. Go to **vercel.com/new** → Import Git Repository → pick the repo.
   First time only: approve Vercel's GitHub App access (fine to scope it to
   selected repos).
3. Framework preset: leave as **Other** for static sites — the committed
   `vercel.json` already carries the config. Click **Deploy**.
4. Optional: Project → Settings → Domains → add the real domain
   (e.g. a `preview.mmm.co` subdomain while Shopify holds the apex).

That's it. Every later `git push` (including Claude's) deploys automatically;
PRs get preview URLs for free.

## Per-repo deploy configs

### LIB (Mmm! landing page) — READY NOW
Root `vercel.json` (already committed):
```json
{
  "outputDirectory": "mmm/site",
  "buildCommand": null,
  "framework": null
}
```
Static; no build. Acceptance: hero, four SKU cards, DSHEA footer render; Fraunces
/ Hanken Grotesk load from Google Fonts.

### Pattern for the next repos (PSI test generator, spendWHERE demo)
When each repo comes into a session's scope, Claude adds one of:

- **Static site** (plain HTML/JS): same `vercel.json` as above with the right
  `outputDirectory`.
- **Framework app** (Next.js/Vite/etc.): usually NO `vercel.json` needed —
  Vercel auto-detects. Just ensure `npm run build` works clean from a fresh
  clone and env vars are documented.
- **Env vars/secrets**: never committed — King enters them in Vercel →
  Project → Settings → Environment Variables; Claude documents the required
  names in the repo's README.

### LIB-the-assistant — not hostable yet
The assistant is a two-line README today. Hosting it means building it: a small
web app + an LLM backend (needs an API key server-side, so it's a framework
app with env vars, not a static page). Scope as its own build project.

## Track B (optional): make Claude deploy-capable from sessions

Only needed if King wants Claude running deploys directly instead of pushing
to Git. Both steps happen in the Claude Code **environment settings**
(claude.ai/code → environment), never in chat:

1. Network access: allow `vercel.com` and `api.vercel.com`.
2. Environment variables: add `VERCEL_TOKEN` (create at
   vercel.com/account/tokens, scope to the team).

Then in any session: `npx vercel deploy` works from the shell. Verify with
`curl -s -o /dev/null -w '%{http_code}' https://api.vercel.com/v2/user` —
anything other than `000` means the policy change took.
