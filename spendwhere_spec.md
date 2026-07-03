# SpendWHERE — Fable/Hermes Phased Build & Compliance Execution Plan

## TL;DR

- **Build SpendWHERE as a pure software layer that never touches, holds, or transmits user funds** — every money movement (stablecoin, LLC-related payments) is executed by a licensed third-party partner under *their* license, which keeps SpendWHERE outside the definition of a “money transmitter” under FinCEN’s 2019 CVC guidance (FIN-2019-G001) and Michigan’s Money Transmission Services Act (Act 250 of 2006). The MVP (Auth+KYC, Onboarding/Literacy, LLC Toolkit, Document Vault+Compliance Calendar) contains **no fund custody at all**, so a deployable, compliant product exists before any wallet feature ships.
- **Recommended stack:** cloud-agnostic containers (Docker) orchestrated on Kubernetes or Docker Compose, a TypeScript monorepo (Next.js 15 front end + Fastify/NestJS API), managed PostgreSQL 16, S3-compatible object storage, and HashiCorp Vault for vendor-neutral secrets — all portable across DigitalOcean (reference target), AWS, GCP, or Azure. Recommended vendors: **Persona** (KYC), and for the later wallet phase **Zero Hash** or **Bridge (Stripe)** as the licensed money-movement partner, optionally **Privy** or **Circle** for wallet UX (concrete pricing below).
- **Launch Michigan-first** (LLC filing $50 via LARA, $25 annual statement; no state MTL for pure software), then expand to low-burden states (Montana first). Human (“King”) must choose the KYC vendor, the wallet partner, and supply brand assets/API keys before the wallet phase — but none of those are needed to build and ship the entire MVP.

## Key Findings

### 1. The compliance line: what keeps SpendWHERE out of money-transmitter scope

- **Federal (FinCEN):** Under FinCEN’s May 9, 2019 interpretive guidance (**FIN-2019-G001**), a provider of unhosted/non-custodial wallet software is not a money transmitter **“because it does not accept and transmit value.”** The regulatory treatment turns on a four-factor control test, quoted verbatim from the guidance: **”(a) who owns the value; (b) where the value is stored; (c) whether the owner interacts directly with the payment system where the CVC runs; and (d) whether the person acting as intermediary has total independent control over the value.”** SpendWHERE must fail all four (never own, store, control, or intermediate funds). FinCEN also expressly confirmed that **software creators are not money transmitters**, and that decentralized/forum-only trading platforms and multisig providers that only add a co-signature (without unilateral control) are outside scope.
- **State (Michigan):** The Money Transmission Services Act (Act 250 of 2006), administered by DIFS, defines money transmission as “selling or issuing payment instruments or stored value devices or receiving money or monetary value for transmission.” The statute expressly **excludes “the provision solely of delivery, online or telecommunications services or network access”** — a pure software UI layer. Critically, Michigan’s DIFS FAQ states that **holding funds in an “e-wallet” IS money transmission requiring a license.** SpendWHERE must therefore never operate a balance-holding wallet; the licensed partner does.
- **The bright line SpendWHERE must never cross:** (1) never take possession or control of customer fiat or crypto, even momentarily; (2) never hold private keys with unilateral transaction ability; (3) never operate an account/ledger where user value is “an entry in the accounts of the provider”;  (4) never convert or exchange currency as principal. Any of these flips SpendWHERE into a licensed money transmitter. Per **MCL §487.1013**, a Michigan licensee must maintain net worth exceeding **$100,000** (or $100,000 + $25,000 per additional location/delegate, up to $1,000,000), plus a surety bond in a principal amount of **at least $500,000 and not more than $1,500,000** (DIFS confirms the $500K–$1.5M bond range), filed through NMLS with a 120-day approval clock. Avoiding this entirely is the core architectural goal.
- **GENIUS Act (federal):** Signed into law **July 18, 2025**, after House passage July 17, 2025 (308–122) and Senate passage June 17, 2025 (68–30). It establishes the first federal framework for payment stablecoins. Per the White House Fact Sheet, it **“requires 100% reserve backing with liquid assets like U.S. dollars or short-term Treasuries and requires issuers to make monthly, public disclosures of the composition of reserves,”** with CEO/CFO certification, **no interest/yield to holders**, and confirms **payment stablecoins are neither securities nor commodities** — but issuers are treated as BSA-regulated financial institutions. These are *issuer* obligations. SpendWHERE (surfacing coins, not issuing) mainly needs to (a) surface only coins from GENIUS-compliant/permitted issuers and NYDFS-approved coins, and (b) ensure its licensed wallet partner carries the BSA/AML program. **Effective date: Jan. 18, 2027 (18 months after enactment) or 120 days after the primary federal payment-stablecoin regulators issue final rulemaking, whichever is earlier** (Greenberg Traurig, July 2025).
- **NYDFS-approved (greenlist) stablecoins:** NYDFS’s Sept. 18, 2023 “General Framework for Greenlisted Coins” lists eight tokens — **Bitcoin, Ethereum, GUSD, PayPal’s PYUSD, GYEN, ZUSD, PAXG, and USDP.** Ripple’s **RLUSD received the NYDFS greenlight Dec. 10, 2024.** The USD stablecoins approved *for issuance in New York* are Paxos (USDP), Gemini (GUSD), and GMO-Z (ZUSD). These are the safest coins for SpendWHERE to surface first.

### 2. KYC/AML: what SpendWHERE does vs. the partner

Even as a software layer, SpendWHERE should run a light-touch identity check at signup and rely on the licensed wallet/stablecoin partner for the full BSA/AML program (customer identification program, transaction monitoring, SAR filing). The partner (e.g., Zero Hash, Bridge) is the registered MSB carrying the AML obligation. SpendWHERE’s own KYC gate improves onboarding quality and is required by most partners before they will accept a referred user. Because SpendWHERE stores SSN/EIN/bank data, it is itself a “financial institution” under the FTC GLBA Safeguards Rule (see §5) regardless of the money-transmission question.

### 3. Third-party providers & pricing (flagged for budgeting)

**KYC / Identity:**

- **Persona (recommended primary)** — ~$0.30–$0.50 per verification; low tiers start around a $250/month minimum (some plans require a 12-month commitment); a free Starter plan exists. Best all-in-one (KYC/KYB/AML/age).
- **Stripe Identity** — ~$1.50 per verification, no minimum; frictionless if already on Stripe.
- **Veriff** — ~$0.80 per verification base; AML/fraud add-ons raise the effective price.
- Build-your-own KYC only becomes economical above ~1M verifications/year.

**Embedded wallet / stablecoin infrastructure (later phase — 2026 pricing for budgeting):**

- **Circle Programmable Wallets** — billed per Monthly Active Wallet (MAW); first **1,000 MAW/month free**, then **$0.050→$0.020/MAW** (All-Included plan, decreasing with volume) with a **$0.01 rebate** per wallet holding ≥10 USDC; no setup fee. Gas Station charges network gas + 5%. Worked examples: ~$200/mo at 5,000 MAW; ~$1,710/mo at 50,000 MAW. Non-custodial (user-controlled).
- **Coinbase Developer Platform Embedded Wallets** — **$0.005 per wallet operation**; first **5,000 ops/month free**; no tiers or minimums (a “send” = 2 ops, ≈$0.01/transaction). US developers can earn ~3.85–4.1% USDC rewards. Non-custodial.
- **Privy (Stripe-owned)** — free under 500 MAU + 50K signatures + $1M monthly volume; **Core $299/month** (≤2,500 MAU), **Scale $499/month** (≤9,999 MAU); usage-based/custom above 10K MAU (enterprise floor “as low as $0.001/signature”). Non-custodial, SOC 2, TEE-based keys.
- **Bridge (Stripe)** — stablecoin orchestration; **~0.10% (10 bps) per stablecoin movement + network fee**; fiat payouts add rail cost (ACH near-zero, SWIFT $15–30). Stripe’s stablecoin checkout is a flat 1.5%. GENIUS-ready.
- **Zero Hash** — full-stack *regulated* infra (FinCEN-registered MSB + money transmitter in 51 US jurisdictions + NYDFS BitLicense); **custom/enterprise pricing, implied take rate ~0.146% of transaction volume**; transaction-based + custody fees, volume discounts. Best fit for a pure-software layer because **Zero Hash IS the licensed entity and carries the MTL/AML/custody burden.**
- **Fireblocks** — enterprise/contact-sales; Essentials tier includes $1M tx volume, **0.20%/tx overage**, 1,000 embedded wallets; annual contract (crowd-reported ~$10K–$30K+/yr). Non-custodial TSS-MPC.

**Recommendation for a pure-software, no-custody posture:** Use **Zero Hash** or **Bridge** as the licensed money-movement partner (they carry the licenses and AML), optionally paired with **Privy** or **Circle** for the non-custodial wallet UX. This keeps SpendWHERE firmly on the software side of every regulatory line.

### 4. Michigan-first checklist + low-burden expansion states

**Michigan LLC formation flow (the toolkit automates/guides this):**

- Articles of Organization filed with LARA (Corporations Division), **$50 fee**; online processing ~2 weeks (expedite: 24hr $50, same-day $100, 2hr $500, 1hr $1,000).
- **Resident (registered) agent required** — a Michigan resident or authorized entity with a physical MI address; no extra state fee to name on the Articles.
- **Annual Statement due Feb 15, $25**; LARA mails a pre-filled form to the resident agent 90 days prior; LLCs formed after Sept 30 skip the first year.
- No newspaper-publication requirement; Michigan does **not** allow anonymous LLCs (member/agent info is public).
- **EIN via IRS Form SS-4 (free)**; online instant if the responsible party has an SSN/ITIN. The Third-Party Designee section lets a service receive the EIN, with authority ending at assignment.
- **No Michigan MTL for a pure-software app** (DIFS excludes delivery/online/network-access-only services; only e-wallet/fund-holding triggers licensing).

**Low-burden expansion states (pure-software fintech):**

- **Montana — the only US state with NO money transmitter license requirement.** Confirmed directly by the Montana Division of Banking and Financial Institutions: *“The Montana Division of Banking and Financial Institutions (Division) does not regulate money transmitters.”* Only federal FinCEN registration would ever apply. Ideal second market.
- States that adopted the **Money Transmission Modernization Act (MTMA)** offer the most predictable, harmonized framework. Per the Conference of State Bank Supervisors: *“To date, thirty-one states have enacted the law in full or in part. Money transmitters licensed in at least one state that has already adopted the MTMA collectively account for 99% of reported money transmission activity.”* This matters only if SpendWHERE ever adds licensed activity; for pure software, prioritize states whose definitions clearly exclude non-custodial software.

### 5. Security architecture (prioritized; GLBA Safeguards Rule applies)

SpendWHERE handles SSN, EIN, bank data, and financial documents, so it is a “financial institution” under the FTC Safeguards Rule (16 CFR 314.4, strengthened effective June 9, 2023). Mandatory controls include encryption at rest and in transit, MFA for all access to customer info, access controls/least privilege, a data-and-systems inventory, secure development, annual penetration testing, a written incident-response plan, and (2024 amendment) **breach notification to the FTC within 30 days for events affecting 500+ consumers.** Civil penalties run up to $100,000 per violation.

Prioritized control spec:

1. **Encryption:** AES-256 at rest (database TDE + field-level/column encryption for SSN/EIN/bank), TLS 1.3 in transit. Field-level encryption for the most sensitive PII.
1. **Secrets:** HashiCorp Vault (cloud-agnostic), dynamic DB credentials with short TTLs, no hardcoded secrets.
1. **AuthN/AuthZ:** OAuth 2.0 + PKCE, JWT with rotation, MFA, RBAC (enforced at the DB layer via Postgres row-level security where possible).
1. **Audit:** immutable, append-only audit logging of all PII access and auth events.
1. **CI/CD security:** SAST + DAST + dependency scanning gates in the pipeline.
1. **Perimeter:** WAF, rate limiting, DDoS protection.
1. **Frameworks:** GLBA Safeguards (mandatory now), SOC 2 Type II (start after MVP controls stabilize), CCPA/CPRA if California becomes a significant market.

## Details

### Recommended cloud-agnostic tech stack

- **Language/runtime:** TypeScript end-to-end (strongly typed, best-supported by AI coding agents; flows types DB→backend→frontend). 
- **Frontend:** Next.js 15 (App Router, React 19), Tailwind, shadcn/ui.
- **Backend:** Fastify 5 (or NestJS for stronger module structure/OpenAPI) on Node 22 LTS. 
- **Database:** PostgreSQL 16 (JSONB, full-text search, pgvector, row-level security), via Drizzle ORM. Use managed Postgres on any cloud (DigitalOcean Managed Postgres is the reference target).
- **Object storage:** S3-compatible abstraction (DigitalOcean Spaces / AWS S3 / MinIO) so the document vault stays portable.
- **Containers/orchestration:** Docker images; Docker Compose for simple deployment, Kubernetes when scale demands. Nothing vendor-locked.
- **Secrets:** HashiCorp Vault (self-hostable, multi-cloud, dynamic secrets + PKI) rather than a cloud-native secrets manager, to preserve portability.
- **CI/CD:** GitHub Actions with SAST/DAST/dependency-scan gates.
- **Repo:** TypeScript monorepo (Turborepo) with AGENTS.md files so the AI coding agent (Claude Fable 5 via the Nous Hermes agent) understands conventions and generates code that fits existing patterns.

### Phased MVP build plan (sequential tickets with acceptance criteria)

Designed so a working, deployable product exists as early as Phase 1 and the agent can build continuously until done or a usage limit is reached.

**PHASE 0 — Foundation & Scaffolding**

- T0.1 Init Turborepo monorepo (web, api, shared packages), AGENTS.md, TS config. *AC: `pnpm build` passes; CI green.*
- T0.2 Dockerize web + api; docker-compose with Postgres. *AC: `docker compose up` serves both; DB reachable.*
- T0.3 CI/CD pipeline (GitHub Actions) with lint, test, SAST, dependency scan. *AC: pipeline blocks on high-severity findings.*
- T0.4 Provision managed Postgres + S3-compatible bucket + Vault (dev). *AC: app reads a secret from Vault; connects to Postgres via dynamic creds.*
- T0.5 Base security: TLS 1.3, WAF/rate-limit middleware, security headers. *AC: TLS Labs “A”; rate limiting returns 429 on abuse.*

**PHASE 1 — Authentication + KYC/AML**

- T1.1 User model + registration/login with OAuth 2.0 + PKCE, JWT rotation. *AC: sign up/in works; tokens rotate; refresh works.*
- T1.2 MFA (TOTP + optional passkey). *AC: MFA required on sensitive actions.*
- T1.3 RBAC + row-level security in Postgres. *AC: user A cannot read user B’s data (tested).*
- T1.4 Field-level AES-256 encryption for SSN/EIN/bank fields. *AC: at-rest ciphertext confirmed in DB; decryption only in app with Vault key.*
- T1.5 Integrate KYC vendor (Persona) — identity verification at onboarding. *AC: sandbox verification returns pass/fail; result stored; raw PII from vendor not persisted beyond token/status.*
- T1.6 Immutable audit logging of all PII access + auth events. *AC: append-only, tamper-evident log.*
- **Deployable milestone: authenticated, KYC-gated app shell in production.**

**PHASE 2 — Onboarding + Financial Literacy**

- T2.1 Onboarding wizard (persona: non-W2/gig/creator; income band $30K–$3M). *AC: profile saved; resumable.*
- T2.2 Financial literacy module framework (content model + progress tracking). *AC: lessons render; completion tracked.*
- T2.3 Investment scheduling/automation stubs (UI + data model only; no fund movement). *AC: user can define a schedule; no money moves.*
- T2.4 Budgeting/tax dashboard v1 (manual/imported data, read-only calculations). *AC: dashboard categorizes spend; no custody.*
- **Deployable milestone: educational, engaging onboarded product.**

**PHASE 3 — LLC Formation Toolkit**

- T3.1 Business name check (LARA name-availability guidance + USPTO trademark search link/API). *AC: user gets availability signal + disclaimer.*
- T3.2 Articles of Organization generator (Michigan Form 700 data capture → downloadable/pre-filled PDF). *AC: valid PDF matching LARA fields; user files themselves or via guided link.*
- T3.3 Operating Agreement + resident-agent guidance templates. *AC: generated document; template library.*
- T3.4 EIN application flow (SS-4 guided; Third-Party Designee explained; link to IRS online assistant). *AC: completed SS-4 data + instructions; no unauthorized filing.*
- T3.5 Compliance disclaimers throughout (not legal advice; user action required). *AC: disclaimers present on every generated doc.*
- **Deployable milestone: working LLC formation toolkit (Michigan).**

**PHASE 4 — Document Vault + Compliance Calendar**

- T4.1 Encrypted document vault (S3-compatible, AES-256, per-user isolation). *AC: upload/download; encrypted at rest; access-controlled.*
- T4.2 Document classification/tagging (Articles, EIN letter, operating agreement, tax docs). *AC: docs categorized and searchable.*
- T4.3 Compliance calendar (MI Annual Statement Feb 15; EIN/tax deadlines; reminders). *AC: deadlines auto-populate from LLC data; notifications fire.*
- T4.4 Audit export + data-subject access/delete (CCPA-ready). *AC: user can export/delete their data.*
- **Deployable milestone: complete MVP — a compliant, deployable one-stop toolkit before any wallet feature.**

**LATER PHASES (post-MVP, require King’s vendor decisions):** stablecoin wallet (via Zero Hash/Bridge + Privy/Circle, strictly non-custodial), property investment hub, social/marketing engine, advisor marketplace, expanded automation.

## Recommendations

1. **Build the MVP with zero fund custody first (Phases 0–4).** This produces a compliant, revenue-ready product with no MTL exposure. Ship each phase’s deployable milestone to production so a working product exists early and survives any usage-limit cutoff.
1. **Lock the compliance guardrails into code and policy now:** a written “no-custody” rule, disclaimers on every generated legal/tax document, and a legal review of the pure-software posture before wallet work. Budget ~$10K–$50K for a formal legal opinion confirming the exemption in Michigan (and each expansion state).
1. **Choose the KYC vendor early (Persona recommended)** — needed in Phase 1. Budget ~$250/month minimum + ~$0.30–$0.50/verification.
1. **Defer the wallet vendor decision** to the post-MVP phase, but pre-select **Zero Hash or Bridge** (they carry the licenses/AML). This is the single most important architectural guardrail: the partner must be the licensed money transmitter and custodian, not SpendWHERE.
1. **Expansion order: Michigan → Montana → MTMA states.** Re-run the licensing analysis before entering any state where SpendWHERE’s activity might touch funds.
1. **Benchmarks that change the plan:** if SpendWHERE ever wants to hold balances, route funds, or take a fee *inside* the flow of funds, STOP — that triggers an MTL (MI: $100K–$1M net worth, $500K–$1.5M surety bond, NMLS filing, 120-day review) and the architecture must change. If KYC volume exceeds ~1M checks/year, revisit build-your-own KYC. If a wallet partner cannot show a current FinCEN MSB registration + relevant state licenses, do not integrate.

## Human (“King”) decision checklist (with cost implications)

1. **KYC vendor** — Persona (~$250/mo min + $0.30–$0.50/verif) vs Stripe Identity ($1.50/verif, no min) vs Veriff ($0.80+/verif). *Needed for Phase 1.*
1. **Wallet/stablecoin partner** — Zero Hash (~0.146% take rate, carries all licenses) vs Bridge (0.10% + network) vs Privy/Circle for UX. *Needed only for the post-MVP wallet phase.*
1. **Which stablecoins to surface** — start with NYDFS-greenlisted / issuance-approved coins (USDP, GUSD, ZUSD, PYUSD, RLUSD) from GENIUS-compliant issuers.
1. **Cloud provider** — DigitalOcean reference (cheapest managed Postgres/Spaces) vs AWS/GCP/Azure; the stack is portable either way.
1. **API keys & brand assets** — logo (green dollar sign + location pin), taglines (“Your eggs deserve more baskets”, “Spend W HERE”), the in-app “Here, We Can Build” signal phrase, and color palette.
1. **Legal opinion budget** — ~$10K–$50K for pure-software exemption confirmation per state.
1. **LLC formation for SpendWHERE itself** — MI Articles $50 + registered agent ($50–$250/yr) + EIN (free) + $25/yr Annual Statement.

## Caveats

- Money-transmission exemptions are **state-specific and easy to misapply**; the pure-software posture must be confirmed by licensed counsel in every operating state. Every authoritative source warns against relying on an exemption without a written legal opinion or regulator confirmation.
- KYC and wallet pricing change frequently; several figures (Privy overage above 10K MAU, Zero Hash, Fireblocks enterprise) are custom/contact-sales and must be re-confirmed before budgeting. Persona and Stripe Identity prices have risen 50%+ recently.
- GENIUS Act implementing regulations were still in rulemaking through 2026 (Treasury ANPRM; FDIC/OCC proposed rules); stablecoin operational details may shift before the Jan. 18, 2027 / rulemaking-driven effective date.
- FinCEN’s 2019 guidance is interpretive, not a safe harbor; the four-factor control test is fact-specific. Any product change that gives SpendWHERE control over value re-opens the analysis and could pull it into MSB/MTL scope.
- This plan is an engineering and compliance roadmap, not legal advice. Engage qualified fintech counsel before launch and before each new state or wallet integration.