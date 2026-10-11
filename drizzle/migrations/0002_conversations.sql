CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  title text NOT NULL DEFAULT 'New conversation',
  character_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX conversations_user_updated_idx ON public.conversations (user_id, updated_at DESC);
CREATE INDEX conversations_character_idx ON public.conversations (character_id, updated_at DESC);

ALTER TABLE public.messages ADD COLUMN conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, id);

-- Backfill: one conversation per character that already has messages.
INSERT INTO public.conversations (title, character_id, created_at, updated_at)
SELECT m.character_id || ' conversation', m.character_id, min(m.created_at), max(m.created_at)
FROM public.messages m GROUP BY m.character_id;
UPDATE public.messages m SET conversation_id = c.id
FROM public.conversations c WHERE c.character_id = m.character_id AND m.conversation_id IS NULL;

COMMENT ON COLUMN public.messages.character_id IS 'Legacy: conversation ownership now via conversation_id; kept for backward compatibility.';