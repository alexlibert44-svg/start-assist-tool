CREATE OR REPLACE FUNCTION public.set_agent_workflow(p_user_id uuid, p_key text, p_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.profile SET agent_workflows = jsonb_set(COALESCE(agent_workflows, '{}'::jsonb), ARRAY[p_key], COALESCE(p_state, 'null'::jsonb), true) WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_agent_workflow(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_agent_workflow(uuid,text,jsonb) TO service_role;