# Your Time with Larry AI — finish the connected workflows

## Goal
Complete the disconnected workflows identified in the uploaded product brief without rebuilding the app, resetting data, or introducing duplicate sources of truth.

## Work
1. Preserve the working foundations: authenticated ownership, AI-independent initial questions, resumable specialist setup, existing character histories, task/habit persistence, points, and plan proposals.
2. Fix data and failure integrity: pass the user's local date into chat context; make AI/tool failure responses accurately report prior successful actions and refresh affected views; persist and retrieve scheduling facts and approved-plan history; retain the approved plan in Larry's conversation; keep plan and linked task details synchronized; make completion rewards and plan approval safe against partial or concurrent failures.
3. Complete the existing views: add a seven-day habit view backed by actual completion records, day-by-day plan navigation with saved status/progress, and grouped profile/settings sections backed by existing persisted fields. Avoid inventing schedule data or adding unsupported profile fields.
4. Replace the setup-only Command Center card with a concise overview of saved today's/upcoming activities, pending tasks, habits, points, rate, consecutive days, and active plan, plus working shortcuts.
5. Add targeted tests for ownership, time-zone boundaries, exactly-once rewards, partial failures, plan approval/retry, weekly filters, and saved profile/settings. Run the existing suite and verify desktop/mobile interaction where a safe signed-in test session is available.

## Technical notes
- Reuse the existing `habits`, completion-history, plans, profiles, and specialist-profile records; do not reset or delete user data.
- Keep server operations owner-scoped and validate inputs. Use an additive database change only if atomicity cannot be safely achieved with the existing persistence layer.
- Do not call the AI service while it is returning insufficient-credit errors. Report AI-dependent behavior as unverified until service access is restored.