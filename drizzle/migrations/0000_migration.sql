CREATE TABLE public.messages (
  id serial PRIMARY KEY,
  content text NOT NULL,
  sender text NOT NULL,
  character_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.habits (
  id serial PRIMARY KEY,
  name text NOT NULL,
  completed boolean DEFAULT false,
  streak integer DEFAULT 0
);
CREATE TABLE public.profile (
  id serial PRIMARY KEY,
  name text NOT NULL,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  focus_sessions integer DEFAULT 0,
  phone_time integer DEFAULT 0,
  member_since timestamptz DEFAULT now()
);
GRANT ALL ON public.messages, public.habits, public.profile TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
INSERT INTO public.profile (name, level, xp, focus_sessions, phone_time) VALUES ('Focus Seeker', 1, 0, 0, 0);
INSERT INTO public.habits (name, completed, streak) VALUES ('Reading', false, 0), ('Exercise', false, 0), ('Study', false, 0), ('No Social Media', false, 0);