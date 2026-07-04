-- Phase 4: encrypted document vault, compliance calendar, data-subject rights.

-- ---------------------------------------------------------------------------
-- T4.1/T4.2 — document vault metadata. Blobs live in the storage backend
-- (local fs in dev, any S3-compatible store in prod), encrypted app-side
-- with a per-user derived AES-256-GCM key. Only ciphertext ever leaves the
-- process.
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename     text NOT NULL,
  content_type text NOT NULL,
  size_bytes   integer NOT NULL CHECK (size_bytes >= 0),
  category     text NOT NULL DEFAULT 'other' CHECK (category IN
               ('articles', 'ein_letter', 'operating_agreement', 'tax', 'identity', 'other')),
  tags         text[] NOT NULL DEFAULT '{}',
  storage_key  text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_user_idx ON documents (user_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_self ON documents FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- T4.3 — compliance calendar + fired reminders.
-- ---------------------------------------------------------------------------
CREATE TABLE compliance_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  due_on       date NOT NULL,
  source       text NOT NULL DEFAULT 'llc' CHECK (source IN ('llc', 'system', 'manual')),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, due_on)
);
CREATE INDEX compliance_events_user_due_idx ON compliance_events (user_id, due_on);
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_events_self ON compliance_events FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

CREATE TABLE notifications (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id  uuid NOT NULL REFERENCES compliance_events(id) ON DELETE CASCADE,
  message   text NOT NULL,
  fired_at  timestamptz NOT NULL DEFAULT now(),
  read_at   timestamptz,
  UNIQUE (user_id, event_id)
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_self ON notifications FOR ALL
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ---------------------------------------------------------------------------
-- T4.4 — data-subject deletion: users may delete their own row (cascades
-- remove every user-scoped table; audit entries are retained by design as
-- required security records).
-- ---------------------------------------------------------------------------
CREATE POLICY users_self_delete ON users FOR DELETE
  USING (id = current_app_user_id());
