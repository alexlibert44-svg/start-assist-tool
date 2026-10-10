ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_character text,
  ADD COLUMN IF NOT EXISTS points_awarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.habits SET points_awarded = true WHERE completed = true;