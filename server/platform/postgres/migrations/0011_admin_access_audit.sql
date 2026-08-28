CREATE OR REPLACE FUNCTION admin.record_access(p_token_hash text,p_action text,p_result text,p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,admin AS $$DECLARE v_actor uuid;BEGIN v_actor:=admin.require_session(p_token_hash,false);INSERT INTO admin.access_events(id,admin_user_id,action,result,request_id)VALUES(gen_random_uuid(),v_actor,left(p_action,100),left(p_result,30),p_request_id);END$$;
REVOKE ALL ON FUNCTION admin.record_access(text,text,text,uuid) FROM PUBLIC;
ALTER FUNCTION admin.record_access(text,text,text,uuid) OWNER TO langtutor_authenticator;
GRANT EXECUTE ON FUNCTION admin.record_access(text,text,text,uuid) TO langtutor_runtime;
