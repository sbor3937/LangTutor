CREATE SCHEMA families AUTHORIZATION langtutor_owner;
CREATE SCHEMA audit AUTHORIZATION langtutor_owner;
CREATE TYPE families.member_role AS ENUM ('owner','admin','guardian','member','child');
CREATE TYPE families.membership_status AS ENUM ('active','left');
CREATE TYPE families.invitation_status AS ENUM ('pending','accepted','revoked','expired');

CREATE TABLE families.families (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_by uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE families.memberships (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  role families.member_role NOT NULL,
  status families.membership_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
CREATE UNIQUE INDEX memberships_one_active_user_uidx ON families.memberships(user_id) WHERE status='active';
CREATE INDEX memberships_family_idx ON families.memberships(family_id) WHERE status='active';
CREATE TABLE families.invitations (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families.families(id) ON DELETE CASCADE,
  email_normalized text,
  invited_user_id uuid REFERENCES identity.users(id) ON DELETE CASCADE,
  role families.member_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status families.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email_normalized IS NOT NULL OR invited_user_id IS NOT NULL),
  CHECK (role <> 'owner')
);
CREATE TABLE families.settings (
  family_id uuid PRIMARY KEY REFERENCES families.families(id) ON DELETE CASCADE,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE families.membership_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  from_family_id uuid,
  to_family_id uuid NOT NULL,
  invitation_id uuid NOT NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit.events (
  id uuid PRIMARY KEY,
  family_id uuid,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  result text NOT NULL,
  safe_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_family_created_idx ON audit.events(family_id,created_at DESC);

ALTER TABLE families.families ENABLE ROW LEVEL SECURITY; ALTER TABLE families.families FORCE ROW LEVEL SECURITY;
ALTER TABLE families.memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE families.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE families.invitations ENABLE ROW LEVEL SECURITY; ALTER TABLE families.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE families.settings ENABLE ROW LEVEL SECURITY; ALTER TABLE families.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE families.membership_history ENABLE ROW LEVEL SECURITY; ALTER TABLE families.membership_history FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY; ALTER TABLE audit.events FORCE ROW LEVEL SECURITY;

CREATE POLICY family_scope ON families.families USING (id=nullif(current_setting('app.family_id',true),'')::uuid) WITH CHECK (id=nullif(current_setting('app.family_id',true),'')::uuid);
CREATE POLICY memberships_scope ON families.memberships USING (family_id=nullif(current_setting('app.family_id',true),'')::uuid OR user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK (family_id=nullif(current_setting('app.family_id',true),'')::uuid);
CREATE POLICY invitations_scope ON families.invitations USING (family_id=nullif(current_setting('app.family_id',true),'')::uuid) WITH CHECK (family_id=nullif(current_setting('app.family_id',true),'')::uuid);
CREATE POLICY settings_scope ON families.settings USING (family_id=nullif(current_setting('app.family_id',true),'')::uuid) WITH CHECK (family_id=nullif(current_setting('app.family_id',true),'')::uuid);
CREATE POLICY history_self ON families.membership_history USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY audit_scope ON audit.events USING (family_id=nullif(current_setting('app.family_id',true),'')::uuid) WITH CHECK (family_id=nullif(current_setting('app.family_id',true),'')::uuid);

ALTER TABLE families.families OWNER TO langtutor_owner;
ALTER TABLE families.memberships OWNER TO langtutor_owner;
ALTER TABLE families.invitations OWNER TO langtutor_owner;
ALTER TABLE families.settings OWNER TO langtutor_owner;
ALTER TABLE families.membership_history OWNER TO langtutor_owner;
ALTER TABLE audit.events OWNER TO langtutor_owner;
GRANT USAGE ON SCHEMA families,audit TO langtutor_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA families TO langtutor_runtime;
GRANT SELECT,INSERT ON audit.events TO langtutor_runtime;
GRANT USAGE ON SCHEMA families,audit TO langtutor_authenticator;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA families TO langtutor_authenticator;
GRANT INSERT ON audit.events TO langtutor_authenticator;

CREATE OR REPLACE FUNCTION families.active_context(p_user_id uuid)
RETURNS TABLE(family_id uuid, role families.member_role)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,families AS $$
 SELECT m.family_id,m.role FROM families.memberships m WHERE m.user_id=p_user_id AND m.status='active' LIMIT 1
$$;
REVOKE ALL ON FUNCTION families.active_context(uuid) FROM PUBLIC;
ALTER FUNCTION families.active_context(uuid) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION families.active_context(uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION families.lookup_invitation(p_token_hash text)
RETURNS TABLE(invitation_id uuid,family_id uuid,email_normalized text,invited_user_id uuid,role families.member_role)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,families AS $$
 SELECT i.id,i.family_id,i.email_normalized,i.invited_user_id,i.role FROM families.invitations i
 WHERE i.token_hash=p_token_hash AND i.status='pending' AND i.expires_at>now() LIMIT 1
$$;
REVOKE ALL ON FUNCTION families.lookup_invitation(text) FROM PUBLIC;
ALTER FUNCTION families.lookup_invitation(text) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION families.lookup_invitation(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION identity.lookup_password_for_reauth(p_user_id uuid)
RETURNS TABLE(password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,identity AS $$
 SELECT c.password_hash FROM identity.credentials c JOIN identity.users u ON u.id=c.user_id WHERE c.user_id=p_user_id AND u.status='active'
$$;
REVOKE ALL ON FUNCTION identity.lookup_password_for_reauth(uuid) FROM PUBLIC;
ALTER FUNCTION identity.lookup_password_for_reauth(uuid) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION identity.lookup_password_for_reauth(uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION families.accept_invitation(p_token_hash text,p_user_id uuid,p_request_id uuid)
RETURNS TABLE(from_family_id uuid,to_family_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,families,identity,audit AS $$
DECLARE inv families.invitations%ROWTYPE; current_membership families.memberships%ROWTYPE; owner_count integer;
BEGIN
  SELECT * INTO inv FROM families.invitations WHERE token_hash=p_token_hash AND status='pending' AND expires_at>now() FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE='P0001'; END IF;
  IF inv.invited_user_id IS DISTINCT FROM p_user_id AND NOT EXISTS (SELECT 1 FROM identity.user_emails e WHERE e.user_id=p_user_id AND e.email_normalized=inv.email_normalized AND e.verified_at IS NOT NULL)
    THEN RAISE EXCEPTION 'INVITATION_TARGET_MISMATCH' USING ERRCODE='P0001'; END IF;
  SELECT * INTO current_membership FROM families.memberships WHERE user_id=p_user_id AND status='active' FOR UPDATE;
  IF current_membership.family_id=inv.family_id THEN RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE='P0001'; END IF;
  IF current_membership.role='owner' THEN
    SELECT count(*) INTO owner_count FROM families.memberships WHERE family_id=current_membership.family_id AND role='owner' AND status='active';
    IF owner_count<=1 THEN RAISE EXCEPTION 'SOLE_OWNER' USING ERRCODE='P0001'; END IF;
  END IF;
  IF current_membership.id IS NOT NULL THEN UPDATE families.memberships SET status='left',left_at=now() WHERE id=current_membership.id; END IF;
  INSERT INTO families.memberships(id,family_id,user_id,role) VALUES(gen_random_uuid(),inv.family_id,p_user_id,inv.role);
  UPDATE families.invitations SET status='accepted',accepted_at=now() WHERE id=inv.id;
  INSERT INTO families.membership_history(id,user_id,from_family_id,to_family_id,invitation_id) VALUES(gen_random_uuid(),p_user_id,current_membership.family_id,inv.family_id,inv.id);
  IF current_membership.family_id IS NOT NULL THEN INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id) VALUES(gen_random_uuid(),current_membership.family_id,p_user_id,'family.member_left','membership',current_membership.id,'success',p_request_id); END IF;
  INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id) VALUES(gen_random_uuid(),inv.family_id,p_user_id,'family.invitation_accepted','invitation',inv.id,'success',p_request_id);
  RETURN QUERY SELECT current_membership.family_id,inv.family_id;
END $$;
REVOKE ALL ON FUNCTION families.accept_invitation(text,uuid,uuid) FROM PUBLIC;
ALTER FUNCTION families.accept_invitation(text,uuid,uuid) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION families.accept_invitation(text,uuid,uuid) TO langtutor_runtime;
