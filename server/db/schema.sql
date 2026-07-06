CREATE TABLE IF NOT EXISTS net_worth_entries (
  id INTEGER PRIMARY KEY, as_of DATE NOT NULL, amount_cents INTEGER NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS income_events (
  id INTEGER PRIMARY KEY, occurred_on DATE NOT NULL, amount_cents INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('asset','labor')), label TEXT
);
CREATE TABLE IF NOT EXISTS mrr_entries (
  id INTEGER PRIMARY KEY, as_of DATE NOT NULL, mrr_cents INTEGER NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS xrp_positions (
  id INTEGER PRIMARY KEY, units REAL NOT NULL, cost_basis_cents INTEGER, updated_at DATE
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY, occurred_on DATE NOT NULL, amount_cents INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
  division TEXT NOT NULL, memo TEXT
);
CREATE TABLE IF NOT EXISTS tax_estimates (
  id INTEGER PRIMARY KEY, created_at DATE NOT NULL, tax_year INTEGER,
  net_se_income_cents INTEGER, se_tax_cents INTEGER, federal_income_cents INTEGER,
  michigan_cents INTEGER, quarterly_cents INTEGER
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY, filename TEXT, original_name TEXT, division TEXT,
  category TEXT, uploaded_at DATE, size_bytes INTEGER
);
CREATE TABLE IF NOT EXISTS lib_docs (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, pursuit_tag TEXT, updated_at DATE
);
CREATE TABLE IF NOT EXISTS lib_sections (
  id INTEGER PRIMARY KEY, doc_id INTEGER REFERENCES lib_docs(id), heading TEXT, body_md TEXT, ord INTEGER
);
CREATE TABLE IF NOT EXISTS fact_cards (
  id INTEGER PRIMARY KEY, fact TEXT NOT NULL, documentary TEXT NOT NULL,
  principle TEXT NOT NULL, pursuit TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pursuits (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE, name TEXT, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY, name TEXT, muscle_group TEXT, equipment TEXT,
  is_bodyweight INTEGER, progression TEXT
);
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY, name TEXT, kcal INTEGER, protein_g INTEGER, carbs_g INTEGER, fat_g INTEGER, slot TEXT
);
CREATE TABLE IF NOT EXISTS day_plans (
  id INTEGER PRIMARY KEY, day_type TEXT, goal TEXT, blocks_json TEXT
);
