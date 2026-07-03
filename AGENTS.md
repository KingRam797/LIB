# SpendWHERE — Agent & Contributor Conventions

## What this is

SpendWHERE is a **pure software layer** for non-W2 earners: onboarding/financial literacy,
an LLC formation toolkit (Michigan-first), a document vault, and a compliance calendar.
Read `spendwhere_spec.md` for the full phased plan and `PROGRESS.md` for current status.

## The compliance bright line (never cross)

SpendWHERE must NEVER:

1. Take possession or control of customer fiat or crypto, even momentarily.
2. Hold private keys with unilateral transaction ability.
3. Operate an account/ledger where user value is an entry in our books.
4. Convert or exchange currency as principal.

Any feature that moves money is executed by a licensed third-party partner under THEIR
license. If a change would violate any of the four rules above, stop and flag it.

## Repo layout

- `apps/web` — Next.js 15 (App Router) frontend.
- `apps/api` — Fastify 5 API (Node 22, TypeScript, ESM).
- `packages/shared` — shared types, secrets provider, field-level crypto.

## Conventions

- TypeScript strict everywhere; ESM (`"type": "module"`).
- Validation with zod at every API boundary.
- Database access through Drizzle ORM; schema lives in `apps/api/src/db/schema.ts`;
  SQL migrations in `apps/api/drizzle/`.
- Secrets come ONLY from the `SecretsProvider` interface in `packages/shared`
  (env-based in dev, Vault in production). Never read process.env for a secret
  outside that provider; never hardcode secrets; `.env*` is gitignored.
- Sensitive PII (SSN/EIN/bank) is encrypted field-level with AES-256-GCM before it
  touches the database. Use the helpers in `packages/shared/src/crypto.ts`.
- Every access to PII and every auth event MUST be recorded via the audit logger
  (`apps/api/src/audit.ts`) — it is append-only and hash-chained.
- Row-level security: API DB access for user-scoped tables goes through
  `withUserDb()` so Postgres RLS enforces isolation. Do not query user-scoped
  tables with the admin pool.
- Tests: vitest. Integration tests expect Postgres at `TEST_DATABASE_URL`
  (docker compose provides it).

## Commands

- `pnpm install` — install workspace deps.
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` — run via turbo.
- `docker compose up` — Postgres + api + web.
- `pnpm --filter @spendwhere/api db:migrate` — apply SQL migrations.
