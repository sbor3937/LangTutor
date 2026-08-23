CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS platform;

DO $$ BEGIN
  CREATE TYPE identity.user_status AS ENUM ('pending', 'active', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE identity.token_purpose AS ENUM ('verify_email', 'reset_password');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS identity.users (
  id uuid PRIMARY KEY,
  status identity.user_status NOT NULL DEFAULT 'pending',
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identity.user_emails (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  email_normalized text NOT NULL UNIQUE,
  email_display text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identity.credentials (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz
);
CREATE TABLE IF NOT EXISTS identity.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_prefix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON identity.sessions(user_id);
CREATE TABLE IF NOT EXISTS identity.one_time_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  purpose identity.token_purpose NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.outbox_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.users FORCE ROW LEVEL SECURITY;
ALTER TABLE identity.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.user_emails FORCE ROW LEVEL SECURITY;
ALTER TABLE identity.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE identity.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE identity.one_time_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.one_time_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE platform.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.outbox_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self ON identity.users;
CREATE POLICY users_self ON identity.users USING (id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS emails_self ON identity.user_emails;
CREATE POLICY emails_self ON identity.user_emails USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS credentials_self ON identity.credentials;
CREATE POLICY credentials_self ON identity.credentials USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS sessions_self ON identity.sessions;
CREATE POLICY sessions_self ON identity.sessions USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS tokens_self ON identity.one_time_tokens;
CREATE POLICY tokens_self ON identity.one_time_tokens USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS outbox_self ON platform.outbox_events;
CREATE POLICY outbox_self ON platform.outbox_events USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION identity.lookup_login(p_email text)
RETURNS TABLE(user_id uuid, password_hash text, status identity.user_status, verified boolean, locked_until timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, identity AS $$
  SELECT u.id, c.password_hash, u.status, e.verified_at IS NOT NULL, c.locked_until
  FROM identity.user_emails e JOIN identity.users u ON u.id=e.user_id JOIN identity.credentials c ON c.user_id=u.id
  WHERE e.email_normalized=lower(trim(p_email)) LIMIT 1
$$;
REVOKE ALL ON FUNCTION identity.lookup_login(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION identity.lookup_session(p_token_hash text)
RETURNS TABLE(user_id uuid, session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, identity AS $$
  SELECT s.user_id, s.id FROM identity.sessions s JOIN identity.users u ON u.id=s.user_id
  WHERE s.token_hash=p_token_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' LIMIT 1
$$;
REVOKE ALL ON FUNCTION identity.lookup_session(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION identity.lookup_one_time_token(p_token_hash text, p_purpose identity.token_purpose)
RETURNS TABLE(user_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, identity AS $$
  SELECT t.user_id FROM identity.one_time_tokens t
  WHERE t.token_hash=p_token_hash AND t.purpose=p_purpose AND t.consumed_at IS NULL AND t.expires_at>now() LIMIT 1
$$;
REVOKE ALL ON FUNCTION identity.lookup_one_time_token(text, identity.token_purpose) FROM PUBLIC;

CREATE OR REPLACE FUNCTION identity.lookup_user_by_email(p_email text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, identity AS $$
  SELECT e.user_id FROM identity.user_emails e JOIN identity.users u ON u.id=e.user_id
  WHERE e.email_normalized=lower(trim(p_email)) AND u.status <> 'blocked' LIMIT 1
$$;
REVOKE ALL ON FUNCTION identity.lookup_user_by_email(text) FROM PUBLIC;
