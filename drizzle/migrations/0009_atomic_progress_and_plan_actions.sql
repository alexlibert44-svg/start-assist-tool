CREATE OR REPLACE FUNCTION public.set_habit_completion_atomic(p_user_id uuid, p_habit_id integer, p_completed boolean, p_local_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_habit public.habits%ROWTYPE;
  v_points integer := 0;
  v_rows integer := 0;
  v_latest timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_habit_id IS NULL OR p_local_date IS NULL THEN
    RAISE EXCEPTION 'Invalid completion request' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_habit FROM public.habits WHERE id = p_habit_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'awarded_points', 0);
  END IF;

  IF v_habit.kind = 'task' THEN
    IF p_completed THEN
      IF NOT COALESCE(v_habit.points_awarded, false) THEN
        UPDATE public.habits
          SET completed = true, points_awarded = true, completed_at = now()
          WHERE id = p_habit_id AND user_id = p_user_id;
        INSERT INTO public.habit_completions (user_id, habit_id, habit_name, kind, local_date, points)
          VALUES (p_user_id, p_habit_id, v_habit.name, 'task', p_local_date, 5)
          ON CONFLICT (habit_id, local_date) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 1 THEN
          v_points := 5;
          INSERT INTO public.profile (user_id, name, xp)
            VALUES (p_user_id, 'User', 5)
            ON CONFLICT (user_id) DO UPDATE SET xp = COALESCE(public.profile.xp, 0) + 5;
        END IF;
      ELSE
        UPDATE public.habits SET completed = true WHERE id = p_habit_id AND user_id = p_user_id;
      END IF;
    ELSE
      IF COALESCE(v_habit.points_awarded, false) THEN
        WITH removed AS (
          DELETE FROM public.habit_completions
          WHERE user_id = p_user_id AND habit_id = p_habit_id
          RETURNING points
        ) SELECT COALESCE(sum(points), 0)::integer INTO v_points FROM removed;
        UPDATE public.profile SET xp = GREATEST(COALESCE(xp, 0) - v_points, 0) WHERE user_id = p_user_id;
      END IF;
      UPDATE public.habits SET completed = false, points_awarded = false, completed_at = NULL
        WHERE id = p_habit_id AND user_id = p_user_id;
      v_points := -v_points;
    END IF;
  ELSIF p_completed THEN
    INSERT INTO public.habit_completions (user_id, habit_id, habit_name, kind, local_date, points)
      VALUES (p_user_id, p_habit_id, v_habit.name, 'habit', p_local_date, 5)
      ON CONFLICT (habit_id, local_date) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
      v_points := 5;
      INSERT INTO public.profile (user_id, name, xp)
        VALUES (p_user_id, 'User', 5)
        ON CONFLICT (user_id) DO UPDATE SET xp = COALESCE(public.profile.xp, 0) + 5;
      UPDATE public.habits SET completed_at = now() WHERE id = p_habit_id AND user_id = p_user_id;
    END IF;
  ELSE
    WITH removed AS (
      DELETE FROM public.habit_completions
      WHERE user_id = p_user_id AND habit_id = p_habit_id AND local_date = p_local_date
      RETURNING points
    ) SELECT COALESCE(sum(points), 0)::integer INTO v_points FROM removed;
    IF v_points > 0 THEN
      UPDATE public.profile SET xp = GREATEST(COALESCE(xp, 0) - v_points, 0) WHERE user_id = p_user_id;
    END IF;
    SELECT max(completed_at) INTO v_latest FROM public.habit_completions
      WHERE user_id = p_user_id AND habit_id = p_habit_id;
    UPDATE public.habits SET completed_at = v_latest WHERE id = p_habit_id AND user_id = p_user_id;
    v_points := -v_points;
  END IF;

  RETURN jsonb_build_object('found', true, 'awarded_points', v_points);
END;
$$;
REVOKE ALL ON FUNCTION public.set_habit_completion_atomic(uuid, integer, boolean, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_habit_completion_atomic(uuid, integer, boolean, date) TO service_role;

CREATE OR REPLACE FUNCTION public.materialize_plan_items(p_user_id uuid, p_items jsonb, p_tz_offset_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
  v_habit_id integer;
  v_new_habit_id integer;
  v_habit public.habits%ROWTYPE;
  v_due_at timestamptz;
  v_task_name text;
  v_character text;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid plan activities' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(v_item->>'category', '') = 'commitment' THEN
      v_item := jsonb_set(v_item, '{habitId}', 'null'::jsonb, true);
    ELSE
      v_habit_id := COALESCE(NULLIF(v_item->>'habitId', '')::integer, NULLIF(v_item->>'habit_id', '')::integer);
      v_due_at := (((v_item->>'date')::date + (v_item->>'end')::time) AT TIME ZONE 'UTC')
        + make_interval(mins => COALESCE(p_tz_offset_minutes, 0));
      v_character := CASE WHEN COALESCE(v_item->>'character', 'Larry') = 'Larry' THEN NULL ELSE v_item->>'character' END;
      v_task_name := COALESCE(v_item->>'title', '') || ' (' || left(COALESCE(v_item->>'day', ''), 3) || ' ' || COALESCE(v_item->>'start', '') || ')';
      IF v_habit_id IS NULL THEN
        INSERT INTO public.habits (name, completed, streak, due_at, kind, linked_character, points_awarded, user_id)
          VALUES (v_task_name, false, 0, v_due_at, 'task', v_character, false, p_user_id)
          RETURNING id INTO v_new_habit_id;
        v_item := jsonb_set(v_item, '{habitId}', to_jsonb(v_new_habit_id), true);
      ELSE
        SELECT * INTO v_habit FROM public.habits WHERE id = v_habit_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'PLAN_ACTIVITY_LINK_INVALID' USING ERRCODE = '23503';
        END IF;
        IF v_habit.kind = 'task' THEN
          UPDATE public.habits SET name = v_task_name, due_at = v_due_at, linked_character = v_character
            WHERE id = v_habit_id AND user_id = p_user_id;
        ELSE
          UPDATE public.habits SET name = COALESCE(v_item->>'title', name)
            WHERE id = v_habit_id AND user_id = p_user_id;
        END IF;
        v_item := jsonb_set(v_item, '{habitId}', to_jsonb(v_habit_id), true);
      END IF;
    END IF;
    v_result := v_result || jsonb_build_array(v_item);
  END LOOP;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.materialize_plan_items(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_plan_items(uuid, jsonb, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.save_plan_schedule_atomic(p_user_id uuid, p_plan_id uuid, p_items jsonb, p_tz_offset_minutes integer, p_expected_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_schedule jsonb;
BEGIN
  IF p_user_id IS NULL OR p_plan_id IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid plan update' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_plan.status NOT IN ('draft', 'active') THEN RAISE EXCEPTION 'PLAN_NOT_EDITABLE' USING ERRCODE = '40001'; END IF;
  IF v_plan.version <> p_expected_version THEN RAISE EXCEPTION 'PLAN_VERSION_CONFLICT' USING ERRCODE = '40001'; END IF;
  IF v_plan.status = 'active' THEN
    v_schedule := public.materialize_plan_items(p_user_id, p_items, p_tz_offset_minutes);
  ELSE
    v_schedule := p_items;
  END IF;
  UPDATE public.plans SET schedule = v_schedule, version = version + 1, updated_at = now()
    WHERE id = p_plan_id AND user_id = p_user_id RETURNING * INTO v_plan;
  RETURN to_jsonb(v_plan);
END;
$$;
REVOKE ALL ON FUNCTION public.save_plan_schedule_atomic(uuid, uuid, jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_plan_schedule_atomic(uuid, uuid, jsonb, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_plan_atomic(p_user_id uuid, p_plan_id uuid, p_tz_offset_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_schedule jsonb;
BEGIN
  IF p_user_id IS NULL OR p_plan_id IS NULL THEN RAISE EXCEPTION 'Invalid plan approval' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_plan.status = 'active' THEN RETURN to_jsonb(v_plan); END IF;
  IF v_plan.status <> 'draft' THEN RAISE EXCEPTION 'PLAN_NOT_APPROVABLE' USING ERRCODE = '40001'; END IF;
  v_schedule := public.materialize_plan_items(p_user_id, v_plan.schedule, p_tz_offset_minutes);
  UPDATE public.plans SET status = 'archived', updated_at = now()
    WHERE user_id = p_user_id AND status = 'active' AND id <> p_plan_id;
  UPDATE public.plans SET status = 'active', schedule = v_schedule, approved_at = now(), updated_at = now()
    WHERE id = p_plan_id AND user_id = p_user_id RETURNING * INTO v_plan;
  RETURN to_jsonb(v_plan);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_plan_atomic(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_atomic(uuid, uuid, integer) TO service_role;