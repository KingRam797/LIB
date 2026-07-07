-- SpendWHERE initial schema (Phase 1)
-- Runs as the migration (owner) role. The runtime application role
-- (spendwhere_app) is created/granted by the migration runner and is
-- subject to row-level security on all user-scoped tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Users (T1.1)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  -- T1.2: TOTP secret is stored field-level encrypted (AES-256-GCM, app-side)
  totp_secret_enc text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  -- T1.5: only the status + vendor inquiry token live here, never raw KYC PII
  kyc_status    text NOT NULL DEFAULT 'not_started'
                CHECK (kyc_status IN ('not_started', 'pending', 'passed', 'failed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Refresh tokens (T1.1) — opaque tokens stored hashed; rotation + reuse
-- detection via family revocation.
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  mfa_verified boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- Sensitive profile (T1.4) — SSN/EIN/bank fields arrive AES-256-GCM
-- encrypted from the app layer; this table never sees plaintext.
-- ---------------------------------------------------------------------------
CREATE TABLE sensitive_profiles (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ssn_enc     text,
  ein_enc     text,
  bank_routing_enc text,
  bank_account_enc text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- KYC inquiries (T1.5) — vendor reference + status only.
-- ---------------------------------------------------------------------------
CREATE TABLE kyc_inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor      text NOT NULL DEFAULT 'persona',
  inquiry_id  text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'passed', 'failed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kyc_inquiries_user_idx ON kyc_inquiries (user_id);

-- ---------------------------------------------------------------------------
-- Audit log (T1.6) — append-only, hash-chained.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  action        text NOT NULL,
  resource      text NOT NULL,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash     text NOT NULL,
  entry_hash    text NOT NULL
);

-- Reject UPDATE/DELETE at the database level regardless of role grants.
CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation();

-- ---------------------------------------------------------------------------
-- Row-level security (T1.3). The app connects as the non-owner role
-- spendwhere_app (provisioned by the migration runner, NOBYPASSRLS) and sets
-- app.user_id per transaction via withUserDb(); policies compare against it.
-- Auth-time lookups (login by email, token rotation) use the explicit
-- app.auth_context policies below.
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_inquiries ENABLE ROW LEVEL SECURITY;

-- current_setting returns '' when unset (missing_ok=true) -> no rows match.
CREATE FUNCTION current_app_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION current_app_is_auth() RETURNS boolean AS $$
  SELECT current_setting('app.auth_context', true) = 'on';
$$ LANGUAGE sql STABLE;

-- users: a user sees/updates only their own row; the auth context (login,
-- registration, token refresh — before a user identity exists) may read and
-- insert.
CREATE POLICY users_self_select ON users FOR SELECT
  USING (id = current_app_user_id() OR current_app_is_auth());
CREATE POLICY users_self_update ON users FOR UPDATE
  USING (id = current_app_user_id() OR current_app_is_auth());
CREATE POLICY users_auth_insert ON users FOR INSERT
  WITH CHECK (current_app_is_auth());

CREATE POLICY refresh_tokens_auth ON refresh_tokens FOR ALL
  USING (current_app_is_auth() OR user_id = current_app_user_id())
  WITH CHECK (current_app_is_auth() OR user_id = current_app_user_id());

CREATE POLICY sensitive_profiles_self ON sensitive_profiles FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

CREATE POLICY kyc_inquiries_self ON kyc_inquiries FOR ALL
  USING (user_id = current_app_user_id() OR current_app_is_auth())
  WITH CHECK (user_id = current_app_user_id() OR current_app_is_auth());
