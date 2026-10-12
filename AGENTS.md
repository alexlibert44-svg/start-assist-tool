<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The app's JSON API lives in TanStack server routes under src/routes/api/* at the original Express paths, so the ported client hooks call them unchanged.
- Database access goes through src/server/storage.server.ts (admin client, RLS locked), scoped per user via storageFor(uid).
- tsconfig strict extras (exactOptionalPropertyTypes, noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature) are off so the imported source compiles without being rewritten.
- Tasks and daily habits share the habits table (kind = 'task' | 'habit'); every completion goes through storage.setCompletion, which records a row in habit_completions (unique per habit per local date) so points are awarded once and history drives consecutive days and the daily rate.
- "Today" is computed server-side from the browser's timezone offset (?tz= / tzOffsetMinutes), so day rollover needs no scheduled reset job.
- AI agent logic (tools, routing, character scopes) lives in src/routes/api/chat.ts; handoffs return `handoff` and the chat page auto-sends it to the target character via the character store.
- Conversations go through the ConversationRepository interface (src/shared/conversations.ts); the active adapter is exported from src/server/conversations.server.ts so the backend can be swapped (see docs/SUPABASE_SETUP.md) without touching UI or routes.
- Each chat lives at /chat/$conversationId and its character comes from the conversation row; "/" only redirects to the latest conversation.
- Handoffs resolve a target conversation server-side (reuse a model-chosen matching conversation of that character, else create one) and return its id; the legacy /api/messages endpoints remain only for backward compatibility.
- All app data is per signed-in user: /api requests carry the user's bearer token (src/lib/auth-fetch.ts patches fetch), src/start.ts rejects unauthenticated /api calls, and storageFor(uid)/ownerFromRequest filter every query by user_id — because the admin client bypasses RLS, scoping must happen in code.
- Onboarding progress lives on the user's profile row (onboarding_step 0–4 questions, 5 setup, 6 team intro, 7 done); "/" is a splash that routes to /welcome, /onboarding or the latest chat.
- Team Setup stores one specialist_profiles row per (user, kind: learning|wellness|development); the current stage is derived from which rows have completed_at, and profile.team_setup_completed_at marks the finished workflow — so stage state can never disagree with saved data. Access goes through src/server/team-setup.server.ts; chat context gives Larry all completed profiles and each specialist only its own.
