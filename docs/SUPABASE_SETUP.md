# Conversations: persistence and connecting your own Supabase project

## What is used today
Conversations and messages are stored in this project's **Lovable Cloud database**
(tables `public.conversations` and `public.messages`, migration
`drizzle/migrations/0002_conversations.sql`). The app has no sign-in, so every
conversation has `user_id = NULL` (single-user mode). All access happens on the
server through `src/server/conversations.server.ts`; RLS is enabled with no
public policies, so the browser can't read the tables directly.

## Code layout (integration boundary)
| File | Role |
| --- | --- |
| `src/shared/conversations.ts` | Data model + `ConversationRepository` interface (the contract) |
| `src/server/conversations.server.ts` | Current adapter (`cloudRepository`), `conversations` export, `ownerFromRequest()` |
| `src/routes/api/conversations*.ts` | JSON API used by the UI |
| `src/hooks/use-conversations.ts` | Client hooks; UI never talks to the database |
| `src/routes/api/chat.ts` | Agent; reuses or creates specialist conversations on handoff |

## Environment variables
| Name | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | server | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | Publishable/anon key for user-scoped clients |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin key; never in browser code or `VITE_*` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Needed only once sign-in is added |

## Steps to switch to a user-owned Supabase project
1. Create the project and run the SQL below (SQL editor or `supabase db push`).
2. Set the environment variables above in your hosting environment.
3. Add Supabase Auth sign-in to the app, and send the user's access token as
   `Authorization: Bearer <token>` with the `/api/conversations*` and `/api/chat` requests.
4. Change `ownerFromRequest()` to verify the token (`supabase.auth.getUser(token)`)
   and return `{ userId: user.id }`; reject requests without a valid user.
5. Write a `supabaseRepository` implementing `ConversationRepository` with a
   per-request client created from the publishable key + the user's token
   (so RLS applies), and point the `conversations` export at it.
6. Optionally migrate existing rows: export `conversations`/`messages` and import
   them with `user_id` set to the owning user.

## Schema for a user-owned project (with RLS)
```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'New conversation',
  character_id text not null check (character_id in ('Larry','Sensei','Dr Neo','Hassan')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null,           -- 'user' or character id
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.conversations (user_id, updated_at desc);
create index on public.messages (conversation_id, id);

grant select, insert, update, delete on public.conversations, public.messages to authenticated;
grant usage on sequence public.messages_id_seq to authenticated;
grant all on public.conversations, public.messages to service_role;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "own conversations" on public.conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages in own conversations" on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
```
