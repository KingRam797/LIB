# The Counting House
> *"Here, We Can Build."*

A personal Wealth Optimizing Operating System for King, Managing Member, PainOrPane Company LLC.

Five rooms under one roof:
- **Dashboard** — net worth, the $1M-by-55 trajectory, the Piketty ownership-vs-income ratio, MRR toward the voice-architecture goal, and the XRP position.
- **Wealth Mechanics** — a fact engine that rotates 30 cards drawn from seven documentaries, each mapped to one of your active pursuits.
- **SpendWHERE** — income/expense tracking across the six DBA divisions, a Michigan multi-member-LLC quarterly tax estimator, a document vault, and a spend-routing view.
- **LIB** — a living knowledge layer: markdown docs surfaced contextually by the pursuit you're actively working.
- **Fitness** — a day-plan generator built for 25 lb dumbbells + bodyweight, endurance + lean muscle, 4–5 days/week. RESPECT. RETURN. RITUAL.

## Stack
PERN — Postgres (SQLite fallback for local dev), Express, React (Vite), Node. Tailwind for styling. Recharts for charts. Deployed to a DigitalOcean Droplet with PM2 + nginx.

## Quickstart
```bash
# From repo root (Node 20+ recommended)
cp .env.example .env          # fill in values; SQLite works with defaults
npm install                   # installs root + workspaces
npm run db:init               # creates schema + seeds (SQLite by default)
npm run dev                   # server on :4000, client on :5173
```

Open <http://localhost:5173>.

## Visual assets

Every hero animation, fact-card background, and icon is generated through the Higgsfield MCP inside Claude Code. See `HIGGSFIELD_ASSETS.md` for the ordered generation queue and exact prompts. Assets land in `client/public/assets/` under the filenames the components already reference.

## The build

Claude Code ("Claw") builds this in five phases. See `CLAUDE.md`. The first task is always: init git and push to GitHub.

## A word on the tax module

The Michigan/federal quarterly estimator is an **estimate**, a planning instrument — not tax advice. Confirm with a CPA before you pay.
