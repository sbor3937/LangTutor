CREATE TABLE identity.refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES identity.sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  replaced_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON identity.refresh_tokens(user_id);
ALTER TABLE identity.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY refresh_tokens_self ON identity.refresh_tokens USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
ALTER TABLE identity.refresh_tokens OWNER TO langtutor_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.refresh_tokens TO langtutor_runtime;
GRANT SELECT ON identity.refresh_tokens TO langtutor_authenticator;

CREATE OR REPLACE FUNCTION identity.lookup_refresh_token(p_token_hash text)
RETURNS TABLE(user_id uuid, refresh_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, identity AS $$
  SELECT r.user_id, r.id FROM identity.refresh_tokens r JOIN identity.users u ON u.id=r.user_id
  WHERE r.token_hash=p_token_hash AND r.revoked_at IS NULL AND r.rotated_at IS NULL AND r.expires_at>now() AND u.status='active' LIMIT 1
$$;
REVOKE ALL ON FUNCTION identity.lookup_refresh_token(text) FROM PUBLIC;
ALTER FUNCTION identity.lookup_refresh_token(text) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION identity.lookup_refresh_token(text) TO langtutor_runtime;
