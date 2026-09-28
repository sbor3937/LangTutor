-- Catalog only: live requests still require ENABLE_LIVE_AI, a server key,
-- family permission and budgets. FORCE RLS remains enabled throughout.
CREATE POLICY kodik_catalog_migration ON ai.providers FOR INSERT TO langtutor_owner WITH CHECK (provider_key='kodikrouter');
CREATE POLICY kodik_model_migration ON ai.models FOR INSERT TO langtutor_owner WITH CHECK (model_key='kodikrouter/gpt-4.1-nano');
CREATE POLICY kodik_price_migration ON ai.price_versions FOR INSERT TO langtutor_owner WITH CHECK (model_id='00000000-0000-4000-8000-000000000013');

INSERT INTO ai.providers(id,provider_key,display_name,kind,base_url,secret_env_key)
VALUES('00000000-0000-4000-8000-000000000003','kodikrouter','KodikRouter','openai_compatible','https://api.kodikrouter.ru/v1','KODIKROUTER_API_KEY');
INSERT INTO ai.models(id,provider_id,model_key,upstream_model,display_name,max_output_tokens,capabilities)
VALUES('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000003','kodikrouter/gpt-4.1-nano','openai/gpt-4.1-nano','GPT-4.1 nano via KodikRouter',800,'{"json":true,"languages":["it","en"]}');
-- Budget estimate: public catalog 2026-09-27 lists $0.10/$0.40 per 1M;
-- /docs/base states +10% commission. Cached input conservatively charged as
-- ordinary input by the existing ledger. Confirm against account billing before activation.
INSERT INTO ai.price_versions(id,model_id,effective_from,prompt_micros_per_million,completion_micros_per_million,currency)
VALUES('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000013',now(),110000,440000,'USD');

DROP POLICY kodik_price_migration ON ai.price_versions;
DROP POLICY kodik_model_migration ON ai.models;
DROP POLICY kodik_catalog_migration ON ai.providers;
