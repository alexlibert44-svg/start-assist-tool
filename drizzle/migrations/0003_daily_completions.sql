ALTER TABLE public.habits ADD COLUMN kind text NOT NULL DEFAULT 'habit';
UPDATE public.habits SET kind = 'task' WHERE due_at IS NOT NULL OR linked_character IS NOT NULL;
CREATE TABLE public.habit_completions (
  id serial PRIMARY KEY,
  habit_id integer REFERENCES public.habits(id) ON DELETE SET NULL,
  habit_name text NOT NULL,
  kind text NOT NULL,
  local_date date NOT NULL,
  points integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX habit_completions_once_per_day ON public.habit_completions(habit_id, local_date);
CREATE INDEX habit_completions_date ON public.habit_completions(local_date);
GRANT ALL ON public.habit_completions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.habit_completions_id_seq TO service_role;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
INSERT INTO public.habit_completions (habit_id, habit_name, kind, local_date, points, completed_at)
SELECT id, name, kind, (completed_at)::date, 10, completed_at FROM public.habits WHERE points_awarded AND completed_at IS NOT NULL;