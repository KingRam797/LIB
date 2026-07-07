-- Phase 2: onboarding, financial literacy, investment scheduling stubs, budgeting.

-- ---------------------------------------------------------------------------
-- T2.1 — Onboarding wizard (resumable)
-- ---------------------------------------------------------------------------
CREATE TABLE onboarding_profiles (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona      text CHECK (persona IN
               ('gig_worker', 'creator', 'freelancer', 'small_business', 'investor', 'other')),
  income_band  text CHECK (income_band IN
               ('under_30k', '30k_75k', '75k_150k', '150k_500k', '500k_1m', '1m_3m', 'over_3m')),
  goals        jsonb NOT NULL DEFAULT '[]'::jsonb,
  home_state   text,
  current_step integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_profiles_self ON onboarding_profiles FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- T2.2 — Financial literacy: global content + per-user progress
-- ---------------------------------------------------------------------------
CREATE TABLE lessons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,
  summary    text NOT NULL,
  body_md    text NOT NULL,
  sort_order integer NOT NULL
);
-- Lessons are global read-only content: no RLS; app role gets SELECT only.

CREATE TABLE lesson_progress (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_progress_self ON lesson_progress FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- T2.3 — Investment scheduling STUBS. Data model + UI only: nothing in this
-- schema or the API executes transfers. SpendWHERE never moves funds
-- (bright-line rule; see AGENTS.md).
-- ---------------------------------------------------------------------------
CREATE TABLE investment_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  cadence     text NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  target      text NOT NULL CHECK (target IN
              ('emergency_fund', 'index_fund', 'retirement', 'real_estate', 'custom')),
  starts_on   date NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX investment_schedules_user_idx ON investment_schedules (user_id);
ALTER TABLE investment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY investment_schedules_self ON investment_schedules FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- T2.4 — Budgeting/tax dashboard v1: manual/imported rows, read-only math.
-- Convention: amount_cents > 0 = money in (income), < 0 = money out (spend).
-- ---------------------------------------------------------------------------
CREATE TABLE budget_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_on date NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  category    text NOT NULL CHECK (category IN
              ('income', 'housing', 'food', 'transportation', 'business',
               'healthcare', 'taxes', 'savings', 'entertainment', 'other')),
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX budget_transactions_user_date_idx ON budget_transactions (user_id, occurred_on);
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_transactions_self ON budget_transactions FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- Seed lessons (non-W2 earner curriculum v1)
-- ---------------------------------------------------------------------------
INSERT INTO lessons (slug, title, summary, body_md, sort_order) VALUES
('why-non-w2-money-is-different', 'Why non-W2 money is different',
 'No employer withholding means YOU are the payroll department. Learn the three jobs your money system has to do.',
 E'# Why non-W2 money is different\n\nWhen you earn 1099/gig/creator income, nobody withholds taxes, nobody matches retirement contributions, and income arrives in lumps.\n\nYour money system has three jobs an employer used to do:\n\n1. **Withhold taxes** — set aside a slice of every payment the day it lands.\n2. **Smooth income** — turn lumpy revenue into a steady "salary" you pay yourself.\n3. **Fund benefits** — retirement, health costs, and time off are now line items you own.\n\n**Action:** open a separate account (or bucket) for taxes before your next payout.\n\n*Educational content, not financial advice.*', 1),
('the-tax-set-aside-habit', 'The tax set-aside habit',
 'Self-employment tax plus income tax can be 25–35%. Build the transfer-on-arrival habit.',
 E'# The tax set-aside habit\n\nSelf-employed earners pay both halves of Social Security/Medicare (15.3% self-employment tax) **plus** regular income tax.\n\nA simple starting rule: **move 25–30% of every payment** into a tax bucket the day it arrives. Your exact rate depends on your bracket, state, and deductions — a tax professional can tune it.\n\nQuarterly estimated payments are generally due in April, June, September, and January (IRS Form 1040-ES).\n\n**Action:** compute last month''s set-aside gap in the Budget tab.\n\n*Educational content, not tax advice.*', 2),
('llc-basics-for-solo-earners', 'LLC basics for solo earners',
 'What an LLC does (and does not do) for a gig worker, freelancer, or creator.',
 E'# LLC basics for solo earners\n\nAn LLC is a state-registered legal wrapper around your business.\n\n**What it gives you:** liability separation (business debts stay with the business if you keep records clean), a business name, easier business banking, and optional tax elections later (like S-corp).\n\n**What it does NOT give you:** automatic tax savings — a single-member LLC is taxed exactly like a sole proprietor by default.\n\nIn Michigan, filing Articles of Organization costs **$50**, and the **$25 Annual Statement is due every February 15**.\n\n**Action:** try the LLC Toolkit''s name check on your working business name.\n\n*Educational content, not legal advice.*', 3),
('emergency-funds-for-lumpy-income', 'Emergency funds for lumpy income',
 'W2 workers save 3 months of expenses. Lumpy earners need runway math instead.',
 E'# Emergency funds for lumpy income\n\nClassic advice says save 3–6 months of expenses. With variable income, think in **runway**: cash on hand ÷ average monthly burn = months you can survive a dry spell.\n\nBecause your income can drop to zero for a month, aim for the high end: **6 months of lean-mode expenses**.\n\nKeep it boring: high-yield savings, not invested, not locked up.\n\n**Action:** compute your runway with last month''s spend from the Budget tab.\n\n*Educational content, not financial advice.*', 4),
('separating-business-and-personal', 'Separating business and personal money',
 'The single habit that protects your LLC and makes tax season painless.',
 E'# Separating business and personal money\n\nMixing money ("commingling") is the #1 way solo owners lose LLC liability protection and overpay at tax time.\n\nThe clean pattern:\n\n1. All revenue lands in a **business** account.\n2. Business expenses are paid **only** from it.\n3. You pay yourself a regular **owner''s draw** to personal checking.\n4. Taxes and savings move to their buckets on payday.\n\n**Action:** upload your EIN letter and bank docs to the Vault so they''re in one place.\n\n*Educational content, not legal or tax advice.*', 5);
