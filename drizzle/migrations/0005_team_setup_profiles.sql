CREATE TABLE public.specialist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('learning','wellness','development')),
  character_id text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_profiles TO authenticated;
GRANT ALL ON public.specialist_profiles TO service_role;
ALTER TABLE public.specialist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own specialist profiles" ON public.specialist_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.profile ADD COLUMN team_setup_completed_at timestamptz;