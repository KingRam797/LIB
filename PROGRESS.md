# SpendWHERE — Build Progress

> Resumable progress log. Each ticket is marked when its acceptance criteria are met.
> Spec: `spendwhere_spec.md` (committed from the uploaded phased plan — no separate spec
> file existed in the repo when this session started; the repo contained only README.md).

## Session log

- **2026-07-03** — Session start. Verified repo was empty (only README.md on all branches;
  no prior SpendWHERE work existed). Created `.gitignore` with `.env*` BEFORE any other
  files. Committed the uploaded phased plan as `spendwhere_spec.md`. Started Phase 0.

## Phase 0 — Foundation & Scaffolding

- [ ] **T0.1** Turborepo monorepo (apps/web, apps/api, packages/shared), AGENTS.md, TS config — AC: `pnpm build` passes
- [ ] **T0.2** Dockerize web + api; docker-compose with Postgres — AC: `docker compose up` serves both
- [ ] **T0.3** CI/CD (GitHub Actions): lint, test, SAST, dependency scan — AC: pipeline blocks on high severity
- [ ] **T0.4** Secrets provider abstraction (Vault-ready, env fallback for dev) — AC: app reads secrets via provider
- [ ] **T0.5** Base security: security headers, rate limiting — AC: 429 on abuse; headers set

## Phase 1 — Authentication + KYC/AML

- [ ] **T1.1** User model + registration/login, JWT rotation — AC: sign up/in works; tokens rotate; refresh works
- [ ] **T1.2** MFA (TOTP) — AC: MFA required on sensitive actions
- [ ] **T1.3** RBAC + row-level security in Postgres — AC: user A cannot read user B's data (tested)
- [ ] **T1.4** Field-level AES-256 encryption (SSN/EIN/bank) — AC: ciphertext at rest; decrypt only in app
- [ ] **T1.5** KYC vendor integration (Persona, sandbox) — AC: pass/fail stored; no raw vendor PII persisted
- [ ] **T1.6** Immutable audit logging (PII access + auth events) — AC: append-only, tamper-evident

## Environment notes for resuming sessions

- Branch: `claude/spendwhere-phase-1-xznqdl` (push here only)
- `.env*` is gitignored; use `.env.example` as the template
- Managed Postgres / Spaces / Vault are NOT provisioned yet (King decision: cloud provider).
  Dev uses docker-compose Postgres + env-based secrets via the provider abstraction in
  `packages/shared` — swapping to Vault means implementing the same interface.
- KYC vendor not yet chosen by King (Persona recommended). Integration runs in stub mode
  until `PERSONA_API_KEY` is set.
