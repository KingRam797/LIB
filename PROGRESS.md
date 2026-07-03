# SpendWHERE — Build Progress

> Resumable progress log. Each ticket is marked when its acceptance criteria are met.
> Spec: `spendwhere_spec.md` (committed from the uploaded phased plan — no separate spec
> file existed in the repo when this session started; the repo contained only README.md).

## Session log

- **2026-07-03** — Session start. Verified repo was empty (only README.md on all branches;
  no prior SpendWHERE work existed). Created `.gitignore` with `.env*` BEFORE any other
  files. Committed the uploaded phased plan as `spendwhere_spec.md`.
- **2026-07-03** — Phase 0 complete, Phase 1 complete (T1.1–T1.6). 17 integration tests +
  8 unit tests green against real Postgres 16; live server boot verified (register →
  login → /me over HTTP, security headers confirmed).

## Phase 0 — Foundation & Scaffolding

- [x] **T0.1** Turborepo monorepo (apps/web, apps/api, packages/shared), AGENTS.md, TS config
      — AC met: `pnpm build` passes (Next.js 15 web + Fastify 5 API + shared package).
- [x] **T0.2** Dockerfiles for web + api; docker-compose with Postgres 16 + Vault (dev)
      — AC partially verified: compose file written and migration/start command wired, but
      `docker compose up` could NOT be executed in this sandbox (the egress proxy blocks
      Docker Hub/ECR blob CDNs). Tests ran against a real local Postgres 16 instead.
      **Resume note: run `docker compose up` on an unrestricted machine to close this out.**
- [x] **T0.3** GitHub Actions CI: build, lint, `pnpm audit --audit-level high` (blocks on
      high severity), CodeQL SAST, tests against a Postgres service container.
- [x] **T0.4** Secrets abstraction (`SecretsProvider` in packages/shared): env-based in dev,
      Vault KV v2 over plain HTTP API when `VAULT_ADDR`/`VAULT_TOKEN` are set. No vendor SDK.
      (Managed Postgres/Spaces/real Vault not provisioned — cloud provider is King's call.)
- [x] **T0.5** Security headers (helmet: HSTS/CSP/nosniff — verified live) + rate limiting
      (global 120/min/IP, credential endpoints 10/min/IP; 429 verified by test).

## Phase 1 — Authentication + KYC/AML

- [x] **T1.1** Registration/login (scrypt password hashing), JWT access tokens (15 min,
      HS256 via jose) + opaque rotating refresh tokens (SHA-256-hashed at rest, 30 days).
      Rotation + reuse detection revokes the whole token family. AC tested: sign up/in,
      rotation, refresh, reuse → 401 + family dead.
- [x] **T1.2** MFA: TOTP enroll/verify/disable (otplib); secret stored AES-256-GCM encrypted.
      Login requires TOTP once enabled; sensitive endpoints (/me/sensitive) require an
      MFA-verified session — non-MFA token gets 403 (tested).
      *Deviation from spec: passkeys (optional per spec) not yet implemented.*
- [x] **T1.3** RLS in Postgres: app runs as `spendwhere_app` (NOBYPASSRLS, provisioned by the
      migration runner), per-transaction `app.user_id` via `withUserDb()`. AC tested: user A
      sees 0 of user B's rows (select + update), and no rows at all without a user context.
      Role column exists (user/admin) for RBAC.
- [x] **T1.4** Field-level AES-256-GCM for SSN/EIN/bank routing+account (packages/shared
      crypto, versioned wire format `v1:iv:ct+tag`, key via SecretsProvider). AC tested:
      DB stores only `v1:`-prefixed ciphertext; API returns masked values (last 4).
- [x] **T1.5** KYC integration (Persona-shaped): inquiry creation, HMAC-verified webhook,
      dev-only completion hook. Runs in STUB mode until King supplies `PERSONA_API_KEY`.
      AC tested: start → pending → passed lifecycle; only inquiry id + status stored
      (schema has no vendor-PII columns — asserted in test).
- [x] **T1.6** Append-only audit log: UPDATE/DELETE/TRUNCATE blocked by trigger (even for
      admin — tested), app role has INSERT+SELECT only, entries SHA-256 hash-chained.
      AC tested: chain verifies; forced tamper (trigger disabled by superuser) is detected
      with the exact broken row id.

**Phase 1 deployable milestone reached: authenticated, MFA-capable, KYC-gated app shell.**

## Next up (Phase 2 — Onboarding + Financial Literacy)

- [ ] **T2.1** Onboarding wizard (persona: non-W2/gig/creator; income band $30K–$3M) — resumable profile
- [ ] **T2.2** Financial literacy module framework (content model + progress tracking)
- [ ] **T2.3** Investment scheduling stubs (UI + data model only; NO fund movement — bright line)
- [ ] **T2.4** Budgeting/tax dashboard v1 (manual/imported data, read-only calculations)

## How to run

```bash
pnpm install
pnpm build && pnpm test          # unit + integration (needs Postgres; see below)
# Local Postgres for tests: TEST_ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:5432/spendwhere_test
# Dev stack: cp .env.example .env, fill FIELD_ENCRYPTION_KEY (openssl rand -base64 32), then:
pnpm --filter @spendwhere/api db:migrate   # applies drizzle/*.sql + provisions spendwhere_app role
pnpm dev                                    # web :3000, api :4000
# Full stack via containers (needs Docker Hub access): docker compose up
```

## Environment notes for resuming sessions

- Branch: `claude/spendwhere-phase-1-xznqdl` (push here only)
- `.env*` is gitignored; use `.env.example` as the template
- Managed Postgres / Spaces / Vault are NOT provisioned (King decision: cloud provider).
- KYC vendor not chosen by King (Persona recommended); stub mode until `PERSONA_API_KEY` set.
- In this sandbox: Docker image pulls are blocked by the egress proxy — use apt-installed
  Postgres 16 (`sudo service postgresql start`) for tests, as this session did.
- Known deviations to revisit: OAuth2/PKCE flow for third-party clients + passkeys (spec
  T1.1/T1.2 stretch items), TLS 1.3 termination + WAF (T0.5 — belongs to the deployment
  layer/reverse proxy, not app code).
