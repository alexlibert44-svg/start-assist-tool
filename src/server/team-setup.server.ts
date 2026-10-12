// Team Setup data access: one specialist profile row per (user, kind); stage = first incomplete kind.
import { KIND_CHARACTER, SETUP_KINDS, SETUP_SCHEMAS, type SetupKind, type SetupStage, type TeamSetupState } from "@/shared/team-setup";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Row = { kind: string; character_id: string; answers: Record<string, unknown>; completed_at: string | null; updated_at: string };

export async function getTeamSetup(uid: string): Promise<TeamSetupState> {
  const c = await db();
  const [rows, prof] = await Promise.all([
    c.from("specialist_profiles").select("kind, character_id, answers, completed_at, updated_at").eq("user_id", uid),
    c.from("profile").select("team_setup_completed_at").eq("user_id", uid).order("id").limit(1),
  ]);
  if (rows.error) throw new Error(rows.error.message);
  if (prof.error) throw new Error(prof.error.message);
  const byKind = new Map((rows.data as Row[]).map((r) => [r.kind, r]));
  const stages: SetupStage[] = SETUP_KINDS.map((k) => {
    const r = byKind.get(k);
    return { kind: k, character: KIND_CHARACTER[k], answers: r?.answers ?? {}, completedAt: r?.completed_at ?? null, updatedAt: r?.updated_at ?? null };
  });
  return {
    stages,
    currentStage: stages.find((s) => !s.completedAt)?.kind ?? null,
    completedAt: (prof.data?.[0] as { team_setup_completed_at: string | null } | undefined)?.team_setup_completed_at ?? null,
  };
}

export class SetupError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/** Draft (complete=false) saves partial answers of an unfinished stage; complete=true validates fully. Idempotent. */
export async function saveStage(uid: string, kind: SetupKind, answers: unknown, complete: boolean): Promise<TeamSetupState> {
  const c = await db();
  const schema = SETUP_SCHEMAS[kind];
  const existing = await c.from("specialist_profiles").select("completed_at").eq("user_id", uid).eq("kind", kind).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const wasDone = !!existing.data?.completed_at;
  if (complete) {
    const idx = SETUP_KINDS.indexOf(kind);
    if (idx > 0 && !wasDone) {
      const prev = await getTeamSetup(uid);
      if (prev.stages.slice(0, idx).some((s) => !s.completedAt)) throw new SetupError("Please finish the earlier setup stages first.", 409);
    }
  } else if (wasDone) {
    return getTeamSetup(uid); // drafts never overwrite or un-complete a saved profile
  }
  const parsed = complete ? schema.parse(answers) : schema.partial().parse(answers);
  const now = new Date().toISOString();
  const up = await c.from("specialist_profiles").upsert(
    {
      user_id: uid, kind, character_id: KIND_CHARACTER[kind], answers: parsed as never, updated_at: now,
      completed_at: wasDone ? existing.data!.completed_at : complete ? now : null,
    },
    { onConflict: "user_id,kind" },
  );
  if (up.error) throw new Error(up.error.message);
  const state = await getTeamSetup(uid);
  if (!state.currentStage && !state.completedAt) {
    const u = await c.from("profile").update({ team_setup_completed_at: now }).eq("user_id", uid).is("team_setup_completed_at", null);
    if (u.error) throw new Error(u.error.message);
    return getTeamSetup(uid);
  }
  return state;
}

/** Saved profile context for the AI. Larry gets every completed profile; a specialist only its own. */
export async function profileContext(uid: string, charId: string): Promise<string> {
  const state = await getTeamSetup(uid);
  const visible = state.stages.filter((s) => s.completedAt && (charId === "Larry" || s.character === charId));
  const lines = state.stages.map((s) => `${s.character}: ${s.completedAt ? "ready" : "not completed"}`);
  let out = charId === "Larry" ? `\n\nTeam Setup status: ${lines.join(", ")}.` : "";
  if (visible.length) {
    out += `\n\nThe user's saved setup answers (self-reported, not clinical; use them to ground answers, never invent beyond them):\n` +
      visible.map((s) => `${s.kind} profile (${s.character}): ${JSON.stringify(s.answers)}`).join("\n");
    if (visible.some((s) => s.kind === "development")) out += `\nhabitsToBuild are proposals only — never create them as habits unless the user explicitly confirms.`;
  } else if (charId !== "Larry") out += `\n\nThe user has not completed your setup profile yet.`;
  return out;
}
