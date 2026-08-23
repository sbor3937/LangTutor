ALTER TABLE platform.outbox_events ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE platform.outbox_events ADD COLUMN locked_at timestamptz;
ALTER TABLE platform.outbox_events ADD COLUMN last_error_code text;

CREATE OR REPLACE FUNCTION platform.claim_identity_email_event()
RETURNS TABLE(event_id uuid, user_id uuid, event_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT e.id FROM platform.outbox_events e
    WHERE e.processed_at IS NULL AND (e.locked_at IS NULL OR e.locked_at < now()-interval '5 minutes')
      AND e.type IN ('identity.verification.requested','identity.password_reset.requested')
      AND e.attempts < 8
    ORDER BY e.created_at FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE platform.outbox_events e SET locked_at=now(),attempts=e.attempts+1
  FROM candidate c WHERE e.id=c.id
  RETURNING e.id,e.user_id,e.type;
END $$;
REVOKE ALL ON FUNCTION platform.claim_identity_email_event() FROM PUBLIC;
GRANT SELECT, UPDATE ON platform.outbox_events TO langtutor_authenticator;
ALTER FUNCTION platform.claim_identity_email_event() OWNER TO langtutor_authenticator;
GRANT USAGE ON SCHEMA platform TO langtutor_runtime;
GRANT EXECUTE ON FUNCTION platform.claim_identity_email_event() TO langtutor_runtime;
