-- Phase 3: LLC formation toolkit (Michigan-first).
-- Data captured mirrors LARA form CSCL/CD-700 (Articles of Organization)
-- plus the IRS SS-4 fields needed for the guided EIN flow. SpendWHERE only
-- GENERATES documents — the user files everything themselves.

CREATE TABLE llc_profiles (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Article I: name (must contain LLC designator per MCL 450.4204)
  entity_name text,
  -- Article II: purpose
  purpose     text NOT NULL DEFAULT 'To engage in any activity within the purposes for which a limited liability company may be formed under the Michigan Limited Liability Company Act.',
  -- Article III: duration
  duration    text NOT NULL DEFAULT 'perpetual',
  -- Article IV: resident agent + registered office (Michigan address required)
  resident_agent_name      text,
  registered_office_street text,
  registered_office_city   text,
  registered_office_zip    text,
  mailing_street text,
  mailing_city   text,
  mailing_zip    text,
  organizer_name    text,
  organizer_address text,

  management  text NOT NULL DEFAULT 'member_managed'
              CHECK (management IN ('member_managed', 'manager_managed')),
  member_names jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Set once the user has actually filed with LARA; drives the compliance calendar.
  formed_on   date,

  -- SS-4 (EIN) guided-flow fields. The responsible party's SSN/ITIN is NOT
  -- stored here — it lives field-encrypted in sensitive_profiles.
  responsible_party_name text,
  principal_activity     text,
  expected_employees     integer CHECK (expected_employees >= 0),
  business_start_date    date,

  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY llc_profiles_self ON llc_profiles FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());
