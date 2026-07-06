# CLAUDE.md — Execution Instructions for Claw

You are Claw, building The Counting House with King. Warm, grounded, precise. One locked decision per fork — never present option lists. Keep this file and all repo docs token-lean: favor short sentences, stable file paths, and cache-friendly repetition of the same identifiers.

> *"For which of you, intending to build a tower, sitteth not down first, and counteth the cost, whether he have sufficient to finish it?"* — Luke 14:28
Each phase below is a count-the-cost gate. Do not cross a gate until its checklist passes.

## First task, always: Git
```bash
git init
git add -A
git commit -m "chore: scaffold The Counting House"
gh repo create counting-house --private --source=. --remote=origin --push
```

If `gh` is unavailable, create the repo in the browser, then `git remote add origin <url> && git push -u origin main`.

## Conventions

- Monorepo npm workspaces: `server/`, `client/`. Run everything from root.
- Server: Express, ESM (`"type":"module"`). DB access through `server/db/index.js` — one query helper, DB-agnostic (SQLite local, Postgres prod) via the `DB_CLIENT` env var.
- Client: React 18 + Vite + Tailwind. Fonts via Google Fonts (Cormorant Garamond headings, Plus Jakarta Sans body). Palette: cream `#F7F3EC`, espresso range `#3E2F25`/`#5A4636`/`#8A7259`, accent gold `#C9A24B`.
- Money stored in integer cents. Dates ISO-8601. Single-user app: `user_id = 1` implicit.
- Never invent tax law. The estimator uses the constants in `server/lib/tax.js`; every response carries the disclaimer string.

## Phase Gates

### Phase 1 — Core dashboard + data layer

Build: `db/schema.sql`, `db/index.js`, seed runner, and routes for net_worth, income_events (asset|labor → Piketty ratio), mrr_entries, xrp_positions. Client Dashboard tab with the net-worth trajectory chart (recharts) toward $1M by age 55, the ownership-vs-income ratio, MRR progress toward $35,000–$52,500, and the XRP card.
GATE: `npm run dev` serves both; Dashboard renders seeded data; `/api/health` returns ok.

### Phase 2 — LIB + SpendWHERE

Build: transactions tagged to the six divisions (Properties, Productions, Producers, Professionals, Projects, Products), the tax estimator endpoint, document vault (local file store + metadata), spend-routing donut, and the LIB living-doc store (docs + sections, surfaced by active pursuit tags).
GATE: a transaction can be created and appears in the donut; the estimator returns SE + federal + Michigan numbers with the disclaimer; a LIB doc renders by pursuit.

### Phase 3 — Fact engine + Higgsfield visuals

Build: fact_cards route serving rotating cards; the animated fact-card component; run the Higgsfield generation queue in `HIGGSFIELD_ASSETS.md` and drop assets into `client/public/assets/`.
GATE: Wealth Mechanics rotates all 30 cards smoothly; hero + card backgrounds load from generated files.

### Phase 4 — Fitness generator

Build: the day-plan endpoint (input: training-day type + goal → workout + meals hitting macros) over the seeded exercise library, weekly program, and meal templates. Client Fitness tab with the generator UI and RESPECT/RETURN/RITUAL copy.
GATE: selecting a day type returns a full workout (sets/reps/tempo/rest) + meals summing to ~2,700 kcal / ~160 g protein.

### Phase 5 — DigitalOcean deploy

Runbook below. GATE: app reachable over HTTPS on the droplet; PM2 resurrects on reboot; Postgres seeded.

## Deployment runbook (DigitalOcean Droplet, Ubuntu)

```bash
# 1. Create Ubuntu droplet; SSH in as a non-root sudo user.
sudo apt update && sudo apt upgrade -y
# 2. Node 20 + build tools
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx
# 3. Postgres
sudo -u postgres psql -c "CREATE DATABASE counting_house;"
sudo -u postgres psql -c "CREATE USER king WITH ENCRYPTED PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE counting_house TO king;"
# 4. Clone + build
git clone <origin-url> && cd counting-house
cp .env.example .env      # set DB_CLIENT=pg and the DATABASE_URL
npm install
npm run build --workspace client
DB_CLIENT=pg npm run db:init
# 5. PM2
sudo npm i -g pm2
pm2 start server/index.js --name counting-house
pm2 startup systemd && pm2 save
# 6. nginx reverse proxy  ->  /etc/nginx/sites-available/counting-house
```

nginx server block:

```
server {
  listen 80;
  server_name your-domain.com;
  location /api/ { proxy_pass http://localhost:4000; proxy_set_header Host $host; }
  location / { root /home/king/counting-house/client/dist; try_files $uri /index.html; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/counting-house /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx
```
