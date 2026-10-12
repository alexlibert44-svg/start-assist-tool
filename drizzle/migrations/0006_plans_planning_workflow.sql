ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS conversation_id uuid;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS approved_at timestamptz;
CREATE INDEX IF NOT EXISTS plans_user_status_idx ON public.plans (user_id, status);