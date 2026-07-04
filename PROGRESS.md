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

## Phase 2 — Onboarding + Financial Literacy

- [x] **T2.1** Onboarding wizard — persona/income-band/state/goals, saved per step,
      resumable via `currentStep` (tested: partial save survives; earlier answers kept).
- [x] **T2.2** Literacy framework — lessons table (5 seeded non-W2 lessons in migration
      0001), per-user progress; list/detail/complete endpoints + web pages (tested).
- [x] **T2.3** Investment schedule stubs — CRUD on planning rows only; every response
      carries the no-custody notice; test asserts the table has no account/transfer
      columns (bright line enforced in schema).
- [x] **T2.4** Budget/tax dashboard — manual/import transactions, monthly rollup by
      category, 28% educational tax set-aside estimate with gap math (tested).

**Phase 2 deployable milestone reached.**

## Phase 3 — LLC Formation Toolkit (Michigan)

- [x] **T3.1** Name check — format rules (LLC designator per MCL 450.4204, restricted
      words, corp-word conflicts), LARA-style distinguishable-name normalization, and
      direct LARA + USPTO search links. Explicit "does not confirm availability"
      disclaimer (LARA has no public API; user runs the authoritative search).
- [x] **T3.2** Articles of Organization — mirrors LARA form CSCL/CD-700 (Articles I–IV,
      organizer signature block, $50 filing instructions); refuses with a missing-field
      list until required fields exist; downloadable PDF (pdf-lib, no external services).
- [x] **T3.3** Operating agreement (member-managed, separateness clause) + resident-agent
      guidance PDF + machine-readable template catalog at /llc/templates.
- [x] **T3.4** SS-4/EIN prepared-answers PDF with IRS online-assistant link and
      Third-Party Designee explanation. SSN is never stored on the LLC profile and never
      submitted by SpendWHERE.
- [x] **T3.5** LEGAL_DISCLAIMER stamped as the final section of every generated PDF
      (tested on all four docs) + x-spendwhere-disclaimer response header.

**Phase 3 deployable milestone reached.**

## Next up (Phase 4 — Document Vault + Compliance Calendar)

- [ ] **T4.1** Encrypted document vault (storage abstraction, AES-256, per-user isolation)
- [ ] **T4.2** Document classification/tagging + search
- [ ] **T4.3** Compliance calendar (MI Annual Statement Feb 15 etc.; reminders fire)
- [ ] **T4.4** Audit export + data-subject access/delete (CCPA-ready)

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
