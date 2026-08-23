GRANT USAGE ON SCHEMA identity, platform TO langtutor_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO langtutor_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO langtutor_runtime;
GRANT EXECUTE ON FUNCTION identity.lookup_login(text) TO langtutor_runtime;
GRANT EXECUTE ON FUNCTION identity.lookup_session(text) TO langtutor_runtime;
GRANT EXECUTE ON FUNCTION identity.lookup_one_time_token(text, identity.token_purpose) TO langtutor_runtime;
GRANT EXECUTE ON FUNCTION identity.lookup_user_by_email(text) TO langtutor_runtime;

ALTER SCHEMA identity OWNER TO langtutor_owner;
ALTER TABLE identity.users OWNER TO langtutor_owner;
ALTER TABLE identity.user_emails OWNER TO langtutor_owner;
ALTER TABLE identity.credentials OWNER TO langtutor_owner;
ALTER TABLE identity.sessions OWNER TO langtutor_owner;
ALTER TABLE identity.one_time_tokens OWNER TO langtutor_owner;
ALTER TABLE platform.outbox_events OWNER TO langtutor_owner;
GRANT USAGE ON SCHEMA identity TO langtutor_authenticator;
GRANT SELECT ON identity.users, identity.user_emails, identity.credentials, identity.sessions, identity.one_time_tokens TO langtutor_authenticator;
ALTER FUNCTION identity.lookup_login(text) OWNER TO langtutor_authenticator;
ALTER FUNCTION identity.lookup_session(text) OWNER TO langtutor_authenticator;
ALTER FUNCTION identity.lookup_one_time_token(text, identity.token_purpose) OWNER TO langtutor_authenticator;
ALTER FUNCTION identity.lookup_user_by_email(text) OWNER TO langtutor_authenticator;

ALTER DEFAULT PRIVILEGES FOR ROLE langtutor_owner IN SCHEMA identity GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO langtutor_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE langtutor_owner IN SCHEMA platform GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO langtutor_runtime;
