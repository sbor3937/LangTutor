-- SECURITY DEFINER accounting functions are owned by the narrowly used
-- authenticator role. It needs table privileges; the runtime role only gets
-- EXECUTE on those functions and remains NOBYPASSRLS.
GRANT SELECT,INSERT,UPDATE ON ai.requests,ai.usage_reservations,ai.usage_ledger TO langtutor_authenticator;
GRANT SELECT ON ai.providers,ai.models,ai.price_versions,ai.routing_rules,ai.user_budgets TO langtutor_authenticator;
