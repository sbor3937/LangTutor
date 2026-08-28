CREATE SCHEMA ai AUTHORIZATION langtutor_owner;

CREATE TABLE ai.providers (
  id uuid PRIMARY KEY,
  provider_key text NOT NULL UNIQUE CHECK (provider_key ~ '^[a-z0-9_-]+$'),
  display_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('demo','openai_compatible')),
  base_url text,
  secret_env_key text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='demo' AND secret_env_key IS NULL) OR (kind='openai_compatible' AND secret_env_key IS NOT NULL))
);
CREATE TABLE ai.models (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES ai.providers(id),
  model_key text NOT NULL UNIQUE,
  upstream_model text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_output_tokens integer NOT NULL DEFAULT 500 CHECK (max_output_tokens BETWEEN 1 AND 100000),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai.price_versions (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL REFERENCES ai.models(id),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  prompt_micros_per_million bigint NOT NULL DEFAULT 0 CHECK (prompt_micros_per_million>=0),
  completion_micros_per_million bigint NOT NULL DEFAULT 0 CHECK (completion_micros_per_million>=0),
  currency char(3) NOT NULL DEFAULT 'USD',
  CHECK (effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX ai_one_current_price_idx ON ai.price_versions(model_id) WHERE effective_to IS NULL;
CREATE TABLE ai.routing_rules (
  id uuid PRIMARY KEY,
  family_id uuid REFERENCES families.families(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  model_id uuid NOT NULL REFERENCES ai.models(id),
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_system_route_idx ON ai.routing_rules(purpose,priority) WHERE family_id IS NULL;
CREATE UNIQUE INDEX ai_family_route_idx ON ai.routing_rules(family_id,purpose,priority) WHERE family_id IS NOT NULL;
CREATE TABLE ai.user_budgets (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  monthly_token_limit bigint NOT NULL DEFAULT 0 CHECK (monthly_token_limit>=0),
  monthly_cost_limit_micros bigint NOT NULL DEFAULT 0 CHECK (monthly_cost_limit_micros>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai.requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  family_id uuid REFERENCES families.families(id) ON DELETE SET NULL,
  model_id uuid NOT NULL REFERENCES ai.models(id),
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved','succeeded','fallback','failed','rejected')),
  safe_error_code text,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ai_requests_user_created_idx ON ai.requests(user_id,created_at DESC);
CREATE INDEX ai_requests_family_created_idx ON ai.requests(family_id,created_at DESC);
CREATE TABLE ai.usage_reservations (
  request_id uuid PRIMARY KEY REFERENCES ai.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  family_id uuid,
  reserved_tokens bigint NOT NULL CHECK (reserved_tokens>=0),
  reserved_cost_micros bigint NOT NULL CHECK (reserved_cost_micros>=0),
  status text NOT NULL CHECK (status IN ('active','settled','released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reservations_scope_idx ON ai.usage_reservations(family_id,user_id,status,expires_at);
CREATE TABLE ai.usage_ledger (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES ai.requests(id),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  family_id uuid REFERENCES families.families(id) ON DELETE SET NULL,
  model_id uuid NOT NULL REFERENCES ai.models(id),
  price_version_id uuid NOT NULL REFERENCES ai.price_versions(id),
  prompt_tokens bigint NOT NULL CHECK (prompt_tokens>=0),
  completion_tokens bigint NOT NULL CHECK (completion_tokens>=0),
  cached_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_tokens>=0),
  reasoning_tokens bigint NOT NULL DEFAULT 0 CHECK (reasoning_tokens>=0),
  cost_micros bigint NOT NULL CHECK (cost_micros>=0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_ledger_user_created_idx ON ai.usage_ledger(user_id,created_at DESC);
CREATE INDEX ai_ledger_family_created_idx ON ai.usage_ledger(family_id,created_at DESC);

ALTER TABLE ai.providers ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.providers FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.models ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.models FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.price_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.price_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.routing_rules ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.routing_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.user_budgets ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.user_budgets FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.requests ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.requests FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.usage_reservations ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.usage_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE ai.usage_ledger ENABLE ROW LEVEL SECURITY; ALTER TABLE ai.usage_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_catalog_providers ON ai.providers FOR SELECT USING (enabled);
CREATE POLICY ai_catalog_models ON ai.models FOR SELECT USING (enabled);
CREATE POLICY ai_catalog_prices ON ai.price_versions FOR SELECT USING (effective_from<=now() AND (effective_to IS NULL OR effective_to>now()));
CREATE POLICY ai_routes_family ON ai.routing_rules FOR SELECT USING (enabled AND (family_id IS NULL OR family_id=nullif(current_setting('app.family_id',true),'')::uuid));
CREATE POLICY ai_budget_self ON ai.user_budgets USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY ai_requests_self ON ai.requests USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY ai_reservations_self ON ai.usage_reservations USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY ai_ledger_self ON ai.usage_ledger USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);

ALTER TABLE ai.providers OWNER TO langtutor_owner; ALTER TABLE ai.models OWNER TO langtutor_owner;
ALTER TABLE ai.price_versions OWNER TO langtutor_owner; ALTER TABLE ai.routing_rules OWNER TO langtutor_owner;
ALTER TABLE ai.user_budgets OWNER TO langtutor_owner; ALTER TABLE ai.requests OWNER TO langtutor_owner;
ALTER TABLE ai.usage_reservations OWNER TO langtutor_owner; ALTER TABLE ai.usage_ledger OWNER TO langtutor_owner;
GRANT USAGE ON SCHEMA ai TO langtutor_runtime,langtutor_authenticator;
GRANT SELECT ON ai.providers,ai.models,ai.price_versions,ai.routing_rules TO langtutor_runtime;
GRANT SELECT ON ai.user_budgets,ai.requests,ai.usage_reservations,ai.usage_ledger TO langtutor_runtime;

INSERT INTO ai.providers(id,provider_key,display_name,kind) VALUES('00000000-0000-4000-8000-000000000001','demo','Demo Provider','demo');
INSERT INTO ai.providers(id,provider_key,display_name,kind,base_url,secret_env_key) VALUES('00000000-0000-4000-8000-000000000002','openrouter','OpenRouter','openai_compatible','https://openrouter.ai/api/v1','OPENROUTER_API_KEY');
INSERT INTO ai.models(id,provider_id,model_key,upstream_model,display_name,max_output_tokens) VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','demo/italian-a0','demo/italian-a0','Демо-репетитор',500),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','openrouter/gpt-4.1-mini','openai/gpt-4.1-mini','GPT-4.1 mini',500);
INSERT INTO ai.price_versions(id,model_id,effective_from,prompt_micros_per_million,completion_micros_per_million) VALUES
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','2026-01-01',0,0),
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000012','2026-01-01',400000,1600000);
INSERT INTO ai.routing_rules(id,family_id,purpose,model_id,priority) VALUES
 ('00000000-0000-4000-8000-000000000031',NULL,'tutor','00000000-0000-4000-8000-000000000012',100),
 ('00000000-0000-4000-8000-000000000032',NULL,'tutor-demo','00000000-0000-4000-8000-000000000011',100);

CREATE OR REPLACE FUNCTION ai.reserve_tutor_request(p_request_id uuid,p_user_id uuid,p_family_id uuid,p_preferred_model text,p_reserved_tokens bigint)
RETURNS TABLE(model_id uuid,model_key text,provider_key text,upstream_model text,max_output_tokens integer,price_version_id uuid,prompt_rate bigint,completion_rate bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ai,families AS $$
DECLARE v_model ai.models%ROWTYPE; v_provider ai.providers%ROWTYPE; v_price ai.price_versions%ROWTYPE; v_settings jsonb; v_allowed jsonb; v_family_limit bigint:=0; v_user_token_limit bigint:=0; v_user_cost_limit bigint:=0; v_used_tokens bigint:=0; v_used_cost bigint:=0; v_reserved_tokens bigint:=0; v_reserved_cost bigint:=0; v_cost_reserve bigint:=0;
BEGIN
 IF nullif(current_setting('app.user_id',true),'')::uuid IS DISTINCT FROM p_user_id OR nullif(current_setting('app.family_id',true),'')::uuid IS DISTINCT FROM p_family_id THEN RAISE EXCEPTION 'AI_CONTEXT_MISMATCH' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_family_id::text,p_user_id::text)||date_trunc('month',now())::text,0));
 SELECT values INTO v_settings FROM families.settings WHERE family_id=p_family_id;
 IF p_preferred_model IS NOT NULL THEN
   SELECT m.* INTO v_model FROM ai.models m JOIN ai.providers p ON p.id=m.provider_id WHERE m.model_key=p_preferred_model AND m.enabled AND p.enabled;
 ELSE
   SELECT m.* INTO v_model FROM ai.routing_rules r JOIN ai.models m ON m.id=r.model_id JOIN ai.providers p ON p.id=m.provider_id WHERE r.purpose='tutor' AND r.enabled AND m.enabled AND p.enabled AND (r.family_id=p_family_id OR r.family_id IS NULL) ORDER BY (r.family_id IS NOT NULL) DESC,r.priority LIMIT 1;
 END IF;
 IF v_model.id IS NULL THEN RAISE EXCEPTION 'AI_MODEL_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_provider FROM ai.providers WHERE id=v_model.provider_id;
 IF v_provider.kind<>'demo' THEN
   IF coalesce((v_settings->>'aiEnabled')::boolean,false)=false THEN RAISE EXCEPTION 'AI_DISABLED' USING ERRCODE='P0001'; END IF;
   v_allowed:=coalesce(v_settings->'allowedModels','[]'::jsonb);
   IF jsonb_array_length(v_allowed)>0 AND NOT v_allowed ? v_model.model_key THEN RAISE EXCEPTION 'AI_MODEL_NOT_ALLOWED' USING ERRCODE='P0001'; END IF;
 END IF;
 SELECT * INTO v_price FROM ai.price_versions WHERE ai.price_versions.model_id=v_model.id AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1;
 IF v_price.id IS NULL THEN RAISE EXCEPTION 'AI_PRICE_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 v_cost_reserve:=ceil((p_reserved_tokens::numeric*v_price.completion_micros_per_million)/1000000)::bigint;
 v_family_limit:=coalesce((v_settings->>'monthlyTokenLimit')::bigint,0);
 SELECT monthly_token_limit,monthly_cost_limit_micros INTO v_user_token_limit,v_user_cost_limit FROM ai.user_budgets WHERE user_id=p_user_id;
 SELECT coalesce(sum(prompt_tokens+completion_tokens),0),coalesce(sum(cost_micros),0) INTO v_used_tokens,v_used_cost FROM ai.usage_ledger WHERE user_id=p_user_id AND created_at>=date_trunc('month',now());
 SELECT coalesce(sum(reserved_tokens),0),coalesce(sum(reserved_cost_micros),0) INTO v_reserved_tokens,v_reserved_cost FROM ai.usage_reservations WHERE user_id=p_user_id AND status='active' AND expires_at>now();
 IF coalesce(v_user_token_limit,0)>0 AND v_used_tokens+v_reserved_tokens+p_reserved_tokens>v_user_token_limit THEN RAISE EXCEPTION 'AI_USER_TOKEN_BUDGET' USING ERRCODE='P0001'; END IF;
 IF coalesce(v_user_cost_limit,0)>0 AND v_used_cost+v_reserved_cost+v_cost_reserve>v_user_cost_limit THEN RAISE EXCEPTION 'AI_USER_COST_BUDGET' USING ERRCODE='P0001'; END IF;
 IF v_family_limit>0 THEN
   SELECT coalesce(sum(prompt_tokens+completion_tokens),0) INTO v_used_tokens FROM ai.usage_ledger WHERE family_id=p_family_id AND created_at>=date_trunc('month',now());
   SELECT coalesce(sum(reserved_tokens),0) INTO v_reserved_tokens FROM ai.usage_reservations WHERE family_id=p_family_id AND status='active' AND expires_at>now();
   IF v_used_tokens+v_reserved_tokens+p_reserved_tokens>v_family_limit THEN RAISE EXCEPTION 'AI_FAMILY_TOKEN_BUDGET' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO ai.requests(id,user_id,family_id,model_id,purpose,status) VALUES(p_request_id,p_user_id,p_family_id,v_model.id,'tutor','reserved');
 INSERT INTO ai.usage_reservations(request_id,user_id,family_id,reserved_tokens,reserved_cost_micros,status,expires_at) VALUES(p_request_id,p_user_id,p_family_id,p_reserved_tokens,v_cost_reserve,'active',now()+interval '2 minutes');
 RETURN QUERY SELECT v_model.id,v_model.model_key,v_provider.provider_key,v_model.upstream_model,v_model.max_output_tokens,v_price.id,v_price.prompt_micros_per_million,v_price.completion_micros_per_million;
END $$;
REVOKE ALL ON FUNCTION ai.reserve_tutor_request(uuid,uuid,uuid,text,bigint) FROM PUBLIC;
ALTER FUNCTION ai.reserve_tutor_request(uuid,uuid,uuid,text,bigint) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION ai.reserve_tutor_request(uuid,uuid,uuid,text,bigint) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION ai.settle_tutor_request(p_request_id uuid,p_user_id uuid,p_prompt_tokens bigint,p_completion_tokens bigint,p_cached_tokens bigint,p_reasoning_tokens bigint,p_latency_ms integer,p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ai AS $$
DECLARE v_request ai.requests%ROWTYPE; v_price ai.price_versions%ROWTYPE; v_cost bigint;
BEGIN
 SELECT * INTO v_request FROM ai.requests WHERE id=p_request_id AND user_id=p_user_id FOR UPDATE;
 IF v_request.id IS NULL OR nullif(current_setting('app.user_id',true),'')::uuid IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'AI_REQUEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF v_request.status<>'reserved' THEN RAISE EXCEPTION 'AI_REQUEST_ALREADY_FINAL' USING ERRCODE='P0001'; END IF;
 SELECT pv.* INTO v_price FROM ai.price_versions pv WHERE pv.model_id=v_request.model_id AND pv.effective_from<=v_request.created_at AND (pv.effective_to IS NULL OR pv.effective_to>v_request.created_at) ORDER BY pv.effective_from DESC LIMIT 1;
 v_cost:=ceil((p_prompt_tokens::numeric*v_price.prompt_micros_per_million+p_completion_tokens::numeric*v_price.completion_micros_per_million)/1000000)::bigint;
 INSERT INTO ai.usage_ledger(id,request_id,user_id,family_id,model_id,price_version_id,prompt_tokens,completion_tokens,cached_tokens,reasoning_tokens,cost_micros) VALUES(gen_random_uuid(),p_request_id,p_user_id,v_request.family_id,v_request.model_id,v_price.id,p_prompt_tokens,p_completion_tokens,p_cached_tokens,p_reasoning_tokens,v_cost);
 UPDATE ai.usage_reservations SET status='settled' WHERE request_id=p_request_id;
 UPDATE ai.requests SET status=p_status,latency_ms=p_latency_ms,completed_at=now() WHERE id=p_request_id;
 RETURN v_cost;
END $$;
REVOKE ALL ON FUNCTION ai.settle_tutor_request(uuid,uuid,bigint,bigint,bigint,bigint,integer,text) FROM PUBLIC;
ALTER FUNCTION ai.settle_tutor_request(uuid,uuid,bigint,bigint,bigint,bigint,integer,text) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION ai.settle_tutor_request(uuid,uuid,bigint,bigint,bigint,bigint,integer,text) TO langtutor_runtime;

CREATE OR REPLACE FUNCTION ai.fail_tutor_request(p_request_id uuid,p_user_id uuid,p_error_code text,p_latency_ms integer,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ai AS $$
BEGIN
 IF nullif(current_setting('app.user_id',true),'')::uuid IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'AI_CONTEXT_MISMATCH' USING ERRCODE='P0001'; END IF;
 UPDATE ai.requests SET status=p_status,safe_error_code=left(p_error_code,80),latency_ms=p_latency_ms,completed_at=now() WHERE id=p_request_id AND user_id=p_user_id AND status='reserved';
 IF NOT FOUND THEN RAISE EXCEPTION 'AI_REQUEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 UPDATE ai.usage_reservations SET status='released' WHERE request_id=p_request_id;
END $$;
REVOKE ALL ON FUNCTION ai.fail_tutor_request(uuid,uuid,text,integer,text) FROM PUBLIC;
ALTER FUNCTION ai.fail_tutor_request(uuid,uuid,text,integer,text) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION ai.fail_tutor_request(uuid,uuid,text,integer,text) TO langtutor_runtime;
