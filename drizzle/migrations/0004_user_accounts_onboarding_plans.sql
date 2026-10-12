ALTER TABLE public.habits ADD COLUMN user_id uuid;
ALTER TABLE public.habit_completions ADD COLUMN user_id uuid;
ALTER TABLE public.messages ADD COLUMN user_id uuid;
ALTER TABLE public.profile ADD COLUMN user_id uuid;
ALTER TABLE public.profile ADD COLUMN preferred_name text;
ALTER TABLE public.profile ADD COLUMN primary_goal text;
ALTER TABLE public.profile ADD COLUMN biggest_challenge text;
ALTER TABLE public.profile ADD COLUMN phone_usage text;
ALTER TABLE public.profile ADD COLUMN current_situation text;
ALTER TABLE public.profile ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;
ALTER TABLE public.profile ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX profile_one_per_user ON public.profile(user_id);
CREATE INDEX habits_user ON public.habits(user_id);
CREATE INDEX habit_completions_user ON public.habit_completions(user_id, local_date);
CREATE INDEX messages_user ON public.messages(user_id);
CREATE INDEX conversations_user ON public.conversations(user_id, character_id, updated_at DESC);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plans_user ON public.plans(user_id, created_at DESC);
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;