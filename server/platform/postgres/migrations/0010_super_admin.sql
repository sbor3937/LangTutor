CREATE SCHEMA admin AUTHORIZATION langtutor_owner;
CREATE SCHEMA operations AUTHORIZATION langtutor_owner;

CREATE TABLE admin.mfa_methods (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'totp' CHECK (kind='totp'),
  secret_ciphertext bytea NOT NULL,
  secret_nonce bytea NOT NULL,
  secret_tag bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  last_used_step bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin.mfa_enrollments (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  secret_ciphertext bytea NOT NULL,
  secret_nonce bytea NOT NULL,
  secret_tag bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  parent_session_id uuid NOT NULL REFERENCES identity.sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reauthenticated_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX admin_sessions_user_idx ON admin.sessions(user_id,expires_at DESC);
CREATE TABLE admin.access_events (
  id uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES identity.users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  reason text,
  result text NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_access_created_idx ON admin.access_events(created_at DESC);
CREATE TABLE operations.system_events (
  id uuid PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  code text NOT NULL,
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE operations.security_events (
  id uuid PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  actor_user_id uuid,
  code text NOT NULL,
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE operations.feature_flags (
  flag_key text PRIMARY KEY CHECK (flag_key ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES identity.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin.mfa_methods ENABLE ROW LEVEL SECURITY; ALTER TABLE admin.mfa_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE admin.mfa_enrollments ENABLE ROW LEVEL SECURITY; ALTER TABLE admin.mfa_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE admin.sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE admin.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE admin.access_events ENABLE ROW LEVEL SECURITY; ALTER TABLE admin.access_events FORCE ROW LEVEL SECURITY;
ALTER TABLE operations.system_events ENABLE ROW LEVEL SECURITY; ALTER TABLE operations.system_events FORCE ROW LEVEL SECURITY;
ALTER TABLE operations.security_events ENABLE ROW LEVEL SECURITY; ALTER TABLE operations.security_events FORCE ROW LEVEL SECURITY;
ALTER TABLE operations.feature_flags ENABLE ROW LEVEL SECURITY; ALTER TABLE operations.feature_flags FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_mfa_self ON admin.mfa_methods USING(user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY admin_enrollment_self ON admin.mfa_enrollments USING(user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY admin_session_self ON admin.sessions USING(user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('app.user_id',true),'')::uuid);

ALTER TABLE admin.mfa_methods OWNER TO langtutor_owner; ALTER TABLE admin.mfa_enrollments OWNER TO langtutor_owner;
ALTER TABLE admin.sessions OWNER TO langtutor_owner; ALTER TABLE admin.access_events OWNER TO langtutor_owner;
ALTER TABLE operations.system_events OWNER TO langtutor_owner; ALTER TABLE operations.security_events OWNER TO langtutor_owner; ALTER TABLE operations.feature_flags OWNER TO langtutor_owner;
GRANT USAGE ON SCHEMA admin TO langtutor_runtime,langtutor_authenticator;
GRANT SELECT,INSERT,UPDATE,DELETE ON admin.mfa_methods,admin.mfa_enrollments,admin.sessions TO langtutor_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON admin.mfa_methods,admin.mfa_enrollments,admin.sessions TO langtutor_authenticator;
GRANT SELECT,INSERT ON admin.access_events TO langtutor_authenticator;
GRANT USAGE ON SCHEMA operations TO langtutor_authenticator;
GRANT SELECT,INSERT,UPDATE ON operations.system_events,operations.security_events,operations.feature_flags TO langtutor_authenticator;
GRANT SELECT,UPDATE ON identity.users,identity.sessions,identity.refresh_tokens,identity.user_emails TO langtutor_authenticator;
GRANT SELECT ON families.families,families.memberships,audit.events TO langtutor_authenticator;
GRANT SELECT,UPDATE ON ai.providers,ai.models,ai.price_versions,ai.user_budgets TO langtutor_authenticator;

CREATE OR REPLACE FUNCTION admin.is_super_admin(p_user_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,identity AS $$ SELECT coalesce((SELECT is_super_admin AND status='active' FROM identity.users WHERE id=p_user_id),false) $$;
REVOKE ALL ON FUNCTION admin.is_super_admin(uuid) FROM PUBLIC; ALTER FUNCTION admin.is_super_admin(uuid) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.is_super_admin(uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.lookup_session(p_token_hash text)
RETURNS TABLE(user_id uuid,admin_session_id uuid,parent_session_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,admin,identity AS $$
 SELECT a.user_id,a.id,a.parent_session_id FROM admin.sessions a JOIN identity.sessions s ON s.id=a.parent_session_id JOIN identity.users u ON u.id=a.user_id
 WHERE a.token_hash=p_token_hash AND a.revoked_at IS NULL AND a.expires_at>now() AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.is_super_admin LIMIT 1
$$;
REVOKE ALL ON FUNCTION admin.lookup_session(text) FROM PUBLIC; ALTER FUNCTION admin.lookup_session(text) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.lookup_session(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.mark_reauthenticated(p_token_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity AS $$
BEGIN UPDATE admin.sessions a SET reauthenticated_at=now() FROM identity.users u WHERE a.token_hash=p_token_hash AND a.user_id=u.id AND u.is_super_admin AND u.status='active' AND a.revoked_at IS NULL AND a.expires_at>now(); RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION admin.mark_reauthenticated(text) FROM PUBLIC; ALTER FUNCTION admin.mark_reauthenticated(text) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.mark_reauthenticated(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.require_session(p_token_hash text,p_dangerous boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity AS $$
DECLARE v_user uuid; BEGIN SELECT a.user_id INTO v_user FROM admin.sessions a JOIN identity.sessions s ON s.id=a.parent_session_id JOIN identity.users u ON u.id=a.user_id WHERE a.token_hash=p_token_hash AND a.revoked_at IS NULL AND a.expires_at>now() AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.is_super_admin AND (NOT p_dangerous OR a.reauthenticated_at>now()-interval '2 minutes'); IF v_user IS NULL THEN RAISE EXCEPTION 'ADMIN_SESSION_REQUIRED' USING ERRCODE='P0001'; END IF; RETURN v_user; END $$;
REVOKE ALL ON FUNCTION admin.require_session(text,boolean) FROM PUBLIC; ALTER FUNCTION admin.require_session(text,boolean) OWNER TO langtutor_authenticator;

CREATE OR REPLACE FUNCTION admin.overview(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity,families,ai,operations AS $$
DECLARE v_actor uuid; v_result jsonb; BEGIN v_actor:=admin.require_session(p_token_hash,false); SELECT jsonb_build_object('users',(SELECT count(*) FROM identity.users),'families',(SELECT count(*) FROM families.families),'tokensThisMonth',(SELECT coalesce(sum(prompt_tokens+completion_tokens),0) FROM ai.usage_ledger WHERE created_at>=date_trunc('month',now())),'costMicrosThisMonth',(SELECT coalesce(sum(cost_micros),0) FROM ai.usage_ledger WHERE created_at>=date_trunc('month',now())),'openAdminSessions',(SELECT count(*) FROM admin.sessions WHERE revoked_at IS NULL AND expires_at>now()),'criticalEvents',(SELECT count(*) FROM operations.security_events WHERE severity='critical' AND created_at>now()-interval '30 days')) INTO v_result; RETURN v_result; END $$;
REVOKE ALL ON FUNCTION admin.overview(text) FROM PUBLIC; ALTER FUNCTION admin.overview(text) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.overview(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.users_page(p_token_hash text,p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid,email text,display_name text,status text,is_super_admin boolean,family_id uuid,family_role text,tokens_this_month bigint,cost_micros_this_month bigint,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity,families,ai AS $$
DECLARE v_actor uuid; BEGIN v_actor:=admin.require_session(p_token_hash,false); RETURN QUERY SELECT u.id,e.email_display,u.display_name,u.status::text,u.is_super_admin,m.family_id,m.role::text,coalesce(x.tokens,0),coalesce(x.cost,0),u.created_at FROM identity.users u LEFT JOIN identity.user_emails e ON e.user_id=u.id LEFT JOIN families.memberships m ON m.user_id=u.id AND m.status='active' LEFT JOIN LATERAL(SELECT sum(l.prompt_tokens+l.completion_tokens)::bigint tokens,sum(l.cost_micros)::bigint cost FROM ai.usage_ledger l WHERE l.user_id=u.id AND l.created_at>=date_trunc('month',now()))x ON true ORDER BY u.created_at DESC LIMIT least(greatest(p_limit,1),100); END $$;
REVOKE ALL ON FUNCTION admin.users_page(text,integer) FROM PUBLIC; ALTER FUNCTION admin.users_page(text,integer) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.users_page(text,integer) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.families_page(p_token_hash text,p_limit integer DEFAULT 50)
RETURNS TABLE(family_id uuid,name text,member_count bigint,tokens_this_month bigint,cost_micros_this_month bigint,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,families,ai AS $$
DECLARE v_actor uuid; BEGIN v_actor:=admin.require_session(p_token_hash,false); RETURN QUERY SELECT f.id,f.name,(SELECT count(*) FROM families.memberships m WHERE m.family_id=f.id AND m.status='active'),coalesce(x.tokens,0),coalesce(x.cost,0),f.created_at FROM families.families f LEFT JOIN LATERAL(SELECT sum(l.prompt_tokens+l.completion_tokens)::bigint tokens,sum(l.cost_micros)::bigint cost FROM ai.usage_ledger l WHERE l.family_id=f.id AND l.created_at>=date_trunc('month',now()))x ON true ORDER BY f.created_at DESC LIMIT least(greatest(p_limit,1),100); END $$;
REVOKE ALL ON FUNCTION admin.families_page(text,integer) FROM PUBLIC; ALTER FUNCTION admin.families_page(text,integer) OWNER TO langtutor_authenticator; GRANT EXECUTE ON FUNCTION admin.families_page(text,integer) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.ai_catalog(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,ai AS $$
DECLARE v_actor uuid;v_result jsonb;BEGIN v_actor:=admin.require_session(p_token_hash,false);SELECT jsonb_build_object('providers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'key',p.provider_key,'name',p.display_name,'kind',p.kind,'enabled',p.enabled,'secretConfigured',false) ORDER BY p.provider_key) FROM ai.providers p),'[]'::jsonb),'models',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'key',m.model_key,'providerId',m.provider_id,'upstreamModel',m.upstream_model,'name',m.display_name,'enabled',m.enabled,'price',jsonb_build_object('id',pv.id,'promptMicrosPerMillion',pv.prompt_micros_per_million,'completionMicrosPerMillion',pv.completion_micros_per_million,'currency',pv.currency)) ORDER BY m.model_key) FROM ai.models m LEFT JOIN ai.price_versions pv ON pv.model_id=m.id AND pv.effective_to IS NULL),'[]'::jsonb)) INTO v_result;RETURN v_result;END $$;
REVOKE ALL ON FUNCTION admin.ai_catalog(text) FROM PUBLIC;ALTER FUNCTION admin.ai_catalog(text) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.ai_catalog(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.events_page(p_token_hash text,p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,audit,operations AS $$
DECLARE v_actor uuid;v_result jsonb;BEGIN v_actor:=admin.require_session(p_token_hash,false);SELECT jsonb_build_object('admin',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT action,target_type,target_id,reason,result,request_id,created_at FROM admin.access_events ORDER BY created_at DESC LIMIT least(greatest(p_limit,1),100))x),'[]'::jsonb),'security',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT severity,code,safe_details,request_id,created_at FROM operations.security_events ORDER BY created_at DESC LIMIT least(greatest(p_limit,1),100))x),'[]'::jsonb),'system',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT severity,code,safe_details,request_id,created_at FROM operations.system_events ORDER BY created_at DESC LIMIT least(greatest(p_limit,1),100))x),'[]'::jsonb)) INTO v_result;RETURN v_result;END $$;
REVOKE ALL ON FUNCTION admin.events_page(text,integer) FROM PUBLIC;ALTER FUNCTION admin.events_page(text,integer) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.events_page(text,integer) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.flags(p_token_hash text) RETURNS SETOF operations.feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,operations AS $$DECLARE v_actor uuid;BEGIN v_actor:=admin.require_session(p_token_hash,false);RETURN QUERY SELECT * FROM operations.feature_flags ORDER BY flag_key;END$$;
REVOKE ALL ON FUNCTION admin.flags(text) FROM PUBLIC;ALTER FUNCTION admin.flags(text) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.flags(text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.block_user(p_token_hash text,p_target uuid,p_block boolean,p_reason text,p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity,operations AS $$DECLARE v_actor uuid;BEGIN v_actor:=admin.require_session(p_token_hash,true);IF v_actor=p_target THEN RAISE EXCEPTION 'ADMIN_SELF_MUTATION_FORBIDDEN' USING ERRCODE='P0001';END IF;IF char_length(trim(p_reason))<5 THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED' USING ERRCODE='P0001';END IF;UPDATE identity.users SET status=CASE WHEN p_block THEN 'blocked'::identity.user_status ELSE 'active'::identity.user_status END,updated_at=now() WHERE id=p_target;IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0001';END IF;IF p_block THEN UPDATE identity.sessions SET revoked_at=now() WHERE user_id=p_target AND revoked_at IS NULL;UPDATE identity.refresh_tokens SET revoked_at=now() WHERE user_id=p_target AND revoked_at IS NULL;END IF;INSERT INTO admin.access_events(id,admin_user_id,action,target_type,target_id,reason,result,request_id)VALUES(gen_random_uuid(),v_actor,CASE WHEN p_block THEN 'admin.user.blocked' ELSE 'admin.user.unblocked' END,'user',p_target::text,left(p_reason,500),'success',p_request_id);INSERT INTO operations.security_events(id,severity,actor_user_id,code,safe_details,request_id)VALUES(gen_random_uuid(),'warning',v_actor,CASE WHEN p_block THEN 'USER_BLOCKED' ELSE 'USER_UNBLOCKED' END,jsonb_build_object('targetUserId',p_target),p_request_id);END$$;
REVOKE ALL ON FUNCTION admin.block_user(text,uuid,boolean,text,uuid) FROM PUBLIC;ALTER FUNCTION admin.block_user(text,uuid,boolean,text,uuid) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.block_user(text,uuid,boolean,text,uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.revoke_user_sessions(p_token_hash text,p_target uuid,p_reason text,p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,identity AS $$DECLARE v_actor uuid;BEGIN v_actor:=admin.require_session(p_token_hash,true);IF char_length(trim(p_reason))<5 THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED' USING ERRCODE='P0001';END IF;UPDATE identity.sessions SET revoked_at=now() WHERE user_id=p_target AND revoked_at IS NULL;UPDATE identity.refresh_tokens SET revoked_at=now() WHERE user_id=p_target AND revoked_at IS NULL;INSERT INTO admin.access_events(id,admin_user_id,action,target_type,target_id,reason,result,request_id)VALUES(gen_random_uuid(),v_actor,'admin.sessions.revoked','user',p_target::text,left(p_reason,500),'success',p_request_id);END$$;
REVOKE ALL ON FUNCTION admin.revoke_user_sessions(text,uuid,text,uuid) FROM PUBLIC;ALTER FUNCTION admin.revoke_user_sessions(text,uuid,text,uuid) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.revoke_user_sessions(text,uuid,text,uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.set_model_enabled(p_token_hash text,p_model uuid,p_enabled boolean,p_reason text,p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,ai AS $$DECLARE v_actor uuid;BEGIN v_actor:=admin.require_session(p_token_hash,true);IF char_length(trim(p_reason))<5 THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED' USING ERRCODE='P0001';END IF;UPDATE ai.models SET enabled=p_enabled WHERE id=p_model;IF NOT FOUND THEN RAISE EXCEPTION 'MODEL_NOT_FOUND' USING ERRCODE='P0001';END IF;INSERT INTO admin.access_events(id,admin_user_id,action,target_type,target_id,reason,result,request_id)VALUES(gen_random_uuid(),v_actor,'admin.ai_model.enabled_changed','ai_model',p_model::text,left(p_reason,500),'success',p_request_id);END$$;
REVOKE ALL ON FUNCTION admin.set_model_enabled(text,uuid,boolean,text,uuid) FROM PUBLIC;ALTER FUNCTION admin.set_model_enabled(text,uuid,boolean,text,uuid) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.set_model_enabled(text,uuid,boolean,text,uuid) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION admin.set_feature_flag(p_token_hash text,p_key text,p_enabled boolean,p_description text,p_version integer,p_reason text,p_request_id uuid) RETURNS operations.feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin,operations AS $$DECLARE v_actor uuid;v_row operations.feature_flags;BEGIN v_actor:=admin.require_session(p_token_hash,true);IF char_length(trim(p_reason))<5 THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED' USING ERRCODE='P0001';END IF;INSERT INTO operations.feature_flags(flag_key,enabled,description,updated_by)VALUES(p_key,p_enabled,p_description,v_actor)ON CONFLICT(flag_key)DO UPDATE SET enabled=excluded.enabled,description=excluded.description,version=operations.feature_flags.version+1,updated_by=v_actor,updated_at=now() WHERE operations.feature_flags.version=p_version RETURNING * INTO v_row;IF v_row.flag_key IS NULL THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001';END IF;INSERT INTO admin.access_events(id,admin_user_id,action,target_type,target_id,reason,result,request_id)VALUES(gen_random_uuid(),v_actor,'admin.feature_flag.updated','feature_flag',p_key,left(p_reason,500),'success',p_request_id);RETURN v_row;END$$;
REVOKE ALL ON FUNCTION admin.set_feature_flag(text,text,boolean,text,integer,text,uuid) FROM PUBLIC;ALTER FUNCTION admin.set_feature_flag(text,text,boolean,text,integer,text,uuid) OWNER TO langtutor_authenticator;GRANT EXECUTE ON FUNCTION admin.set_feature_flag(text,text,boolean,text,integer,text,uuid) TO langtutor_runtime;
