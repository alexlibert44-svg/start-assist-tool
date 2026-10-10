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
- Database access goes through src/server/storage.server.ts (admin client, RLS locked) because the original app is single-user with no sign-in.
- tsconfig strict extras (exactOptionalPropertyTypes, noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature) are off so the imported source compiles without being rewritten.
