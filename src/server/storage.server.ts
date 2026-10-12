// Server-only port of the original server/storage.ts, backed by Lovable Cloud.
// Rows are mapped to the same camelCase shapes the original Drizzle layer returned.
import type { Habit, InsertHabit, InsertMessage, InsertProfile, Message, Profile } from "@/shared/schema";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type MsgRow = { id: number; content: string; sender: string; character_id: string; created_at: string | null };
type ProfRow = {
  id: number; name: string; level: number | null; xp: number | null;
  focus_sessions: number | null; phone_time: number | null; member_since: string | null;
  preferred_name: string | null; primary_goal: string | null; biggest_challenge: string | null;
  phone_usage: string | null; current_situation: string | null; onboarding_step: number; onboarding_completed: boolean;
};

const toMsg = (r: MsgRow) =>
  ({ id: r.id, content: r.content, sender: r.sender, characterId: r.character_id, createdAt: r.created_at }) as unknown as Message;
const toProf = (r: ProfRow) =>
  ({
    id: r.id, name: r.name, level: r.level, xp: r.xp, focusSessions: r.focus_sessions,
    phoneTime: r.phone_time, memberSince: r.member_since,
    preferredName: r.preferred_name, primaryGoal: r.primary_goal, biggestChallenge: r.biggest_challenge,
    phoneUsage: r.phone_usage, currentSituation: r.current_situation, onboardingStep: r.onboarding_step,
    onboardingCompleted: r.onboarding_completed,
  }) as unknown as Profile;

function profToRow(u: Partial<InsertProfile>) {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row["name"] = u.name;
  if (u.level !== undefined) row["level"] = u.level;
  if (u.xp !== undefined) row["xp"] = u.xp;
  if (u.focusSessions !== undefined) row["focus_sessions"] = u.focusSessions;
  if (u.phoneTime !== undefined) row["phone_time"] = u.phoneTime;
  const extra: [keyof InsertProfile, string][] = [["preferredName", "preferred_name"], ["primaryGoal", "primary_goal"],
    ["biggestChallenge", "biggest_challenge"], ["phoneUsage", "phone_usage"], ["currentSituation", "current_situation"],
    ["onboardingStep", "onboarding_step"], ["onboardingCompleted", "onboarding_completed"]];
  for (const [k, col] of extra) if (u[k] !== undefined) row[col] = u[k];
  return row;
}

type HabitRow = {
  id: number; name: string; completed: boolean | null; streak: number | null; due_at: string | null; kind: string;
  linked_character: string | null; points_awarded: boolean; completed_at: string | null; created_at: string | null;
};
const toHabit = (r: HabitRow) =>
  ({
    id: r.id, name: r.name, completed: r.completed, streak: r.streak, dueAt: r.due_at, kind: r.kind,
    linkedCharacter: r.linked_character, pointsAwarded: r.points_awarded, completedAt: r.completed_at, createdAt: r.created_at,
  }) as Habit;
function habitToRow(u: Partial<InsertHabit>) {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row["name"] = u.name;
  if (u.completed !== undefined) row["completed"] = u.completed;
  if (u.streak !== undefined) row["streak"] = u.streak;
  if (u.dueAt !== undefined) row["due_at"] = u.dueAt;
  if (u.linkedCharacter !== undefined) row["linked_character"] = u.linkedCharacter;
  if (u.kind !== undefined) row["kind"] = u.kind === "task" ? "task" : "habit";
  return row;
}

async function adjustScore(storage: { getProfile: () => Promise<Profile | undefined>; updateProfile: (u: Partial<InsertProfile>) => Promise<Profile> }, delta: number) {
  const prof = await storage.getProfile();
  const newScore = Math.max(0, (prof?.xp ?? 0) + delta);
  await storage.updateProfile({ xp: newScore });
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Every query is scoped to the signed-in user (uid); rows of other users are never read or written.
export function storageFor(uid: string) {
const storage = {
  async getMessages(characterId?: string): Promise<Message[]> {
    const c = await db();
    let q = c.from("messages").select("*").eq("user_id", uid).order("id");
    if (characterId) q = q.eq("character_id", characterId);
    return (check(await q) as MsgRow[]).map(toMsg);
  },
  async createMessage(m: InsertMessage): Promise<Message> {
    const c = await db();
    const row = check(
      await c.from("messages").insert({ content: m.content, sender: m.sender, character_id: m.characterId, user_id: uid }).select().single(),
    );
    return toMsg(row as MsgRow);
  },
  async clearMessages(characterId: string): Promise<void> {
    const c = await db();
    check(await c.from("messages").delete().eq("user_id", uid).eq("character_id", characterId));
  },
  // Habits report "completed" for the user's current local day; tasks keep their one-off state.
  async getHabits(tz = 0): Promise<Habit[]> {
    const c = await db();
    const rows = (check(await c.from("habits").select("*").eq("user_id", uid).order("id")) as HabitRow[]).map(toHabit);
    const today = localDate(tz);
    const { data, error } = await c.from("habit_completions").select("habit_id").eq("user_id", uid).eq("local_date", today);
    if (error) throw new Error(error.message);
    const doneToday = new Set((data ?? []).map((r) => r.habit_id));
    return rows.map((h) => (h.kind === "task" ? h : { ...h, completed: doneToday.has(h.id) }));
  },
  async getHabit(id: number, tz = 0): Promise<Habit | undefined> {
    return (await storage.getHabits(tz)).find((h) => h.id === id);
  },
  async createHabit(h: InsertHabit, tz = 0): Promise<Habit> {
    const c = await db();
    const row = habitToRow(h);
    delete row["completed"];
    const created = toHabit(check(await c.from("habits").insert({ ...row, user_id: uid } as unknown as { name: string }).select().single()) as HabitRow);
    if (h.completed) return (await storage.setCompletion(created.id, true, tz)) ?? created;
    return (await storage.getHabit(created.id, tz)) ?? created;
  },
  // Updates non-completion fields; completion goes through setCompletion so points stay consistent.
  async updateHabit(id: number, u: Partial<InsertHabit>, tz = 0): Promise<Habit | undefined> {
    const c = await db();
    const { completed, ...rest } = u;
    const row = habitToRow(rest);
    if (Object.keys(row).length > 0) {
      const rows = check(await c.from("habits").update(row as { name?: string }).eq("id", id).eq("user_id", uid).select()) as HabitRow[];
      if (!rows[0]) return undefined;
    }
    if (completed !== undefined) return storage.setCompletion(id, !!completed, tz);
    return storage.getHabit(id, tz);
  },
  // Idempotent. Habits: one completion row per local day (unique index). Tasks: once, guarded by points_awarded.
  async setCompletion(id: number, done: boolean, tz = 0): Promise<Habit | undefined> {
    const c = await db();
    const rows = check(await c.from("habits").select("*").eq("id", id).eq("user_id", uid)) as HabitRow[];
    const h = rows[0];
    if (!h) return undefined;
    const today = localDate(tz);
    if (h.kind === "task") {
      if (done) {
        const upd = check(
          await c.from("habits").update({ completed: true, points_awarded: true, completed_at: new Date().toISOString() })
            .eq("id", id).eq("points_awarded", false).select(),
        ) as HabitRow[];
        if (upd[0]) {
          check(await c.from("habit_completions").insert({ user_id: uid, habit_id: id, habit_name: h.name, kind: "task", local_date: today, points: SCORE_PER_COMPLETION }).select());
          await adjustScore(storage, SCORE_PER_COMPLETION);
        }
      } else {
        const upd = check(
          await c.from("habits").update({ completed: false, points_awarded: false, completed_at: null })
            .eq("id", id).eq("points_awarded", true).select(),
        ) as HabitRow[];
        if (upd[0]) {
          const del = check(await c.from("habit_completions").delete().eq("habit_id", id).select()) as { points: number }[];
          await adjustScore(storage, -del.reduce((a, r) => a + r.points, 0));
        } else check(await c.from("habits").update({ completed: false }).eq("id", id).select());
      }
    } else if (done) {
      const ins = await c.from("habit_completions")
        .upsert({ user_id: uid, habit_id: id, habit_name: h.name, kind: "habit", local_date: today, points: SCORE_PER_COMPLETION },
          { onConflict: "habit_id,local_date", ignoreDuplicates: true })
        .select();
      if (ins.error) throw new Error(ins.error.message);
      if ((ins.data ?? []).length > 0) {
        await adjustScore(storage, SCORE_PER_COMPLETION);
        check(await c.from("habits").update({ completed_at: new Date().toISOString() }).eq("id", id).select());
      }
    } else {
      const del = check(await c.from("habit_completions").delete().eq("habit_id", id).eq("local_date", today).select()) as { points: number }[];
      if (del.length) await adjustScore(storage, -del.reduce((a, r) => a + r.points, 0));
    }
    return storage.getHabit(id, tz);
  },
  // Deleting keeps earned points and completion history (habit_id becomes null).
  async deleteHabit(id: number): Promise<boolean> {
    const c = await db();
    const rows = check(await c.from("habits").delete().eq("id", id).eq("user_id", uid).select()) as HabitRow[];
    return rows.length > 0;
  },
  async getStats(tz = 0) {
    const c = await db();
    const today = localDate(tz);
    const [items, prof, comps] = await Promise.all([
      storage.getHabits(tz),
      storage.getProfile(),
      c.from("habit_completions").select("local_date").eq("user_id", uid).order("local_date", { ascending: false }).limit(2000),
    ]);
    if (comps.error) throw new Error(comps.error.message);
    const days = new Set((comps.data ?? []).map((r) => r.local_date as string));
    let d = days.has(today) ? today : shiftDate(today, -1);
    let consecutiveDays = 0;
    while (days.has(d)) { consecutiveDays++; d = shiftDate(d, -1); }
    const dueToday = items.filter((h) => h.kind !== "task" || (h.dueAt && localDate(tz, new Date(h.dueAt)) === today));
    const doneToday = dueToday.filter((h) => h.completed).length;
    return {
      points: prof?.xp ?? 0,
      consecutiveDays,
      today,
      dueToday: dueToday.length,
      completedToday: doneToday,
      dailyCompletionRate: dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : null,
    };
  },
  async getProfile(): Promise<Profile | undefined> {
    const c = await db();
    const rows = check(await c.from("profile").select("*").eq("user_id", uid).order("id").limit(1)) as ProfRow[];
    return rows[0] ? toProf(rows[0]) : undefined;
  },
  async updateProfile(u: Partial<InsertProfile>): Promise<Profile> {
    const c = await db();
    const existing = await storage.getProfile();
    if (!existing) {
      const row = check(
        await c.from("profile").insert({ ...profToRow(u), user_id: uid, name: u.name || "User" } as { name: string }).select().single(),
      );
      return toProf(row as ProfRow);
    }
    const row = check(await c.from("profile").update(profToRow(u) as { name?: string }).eq("id", existing.id).select().single());
    return toProf(row as ProfRow);
  },
};
return storage;
}
export type Storage = ReturnType<typeof storageFor>;

export const SCORE_PER_COMPLETION = 5;

// tz = Date.getTimezoneOffset() of the user's browser (minutes, UTC - local).
export function localDate(tz = 0, at = new Date()): string {
  return new Date(at.getTime() - tz * 60000).toISOString().slice(0, 10);
}
function shiftDate(d: string, days: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
export function tzFrom(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 840 ? n : 0;
}

export function zodError(err: unknown) {
  const e = err as { errors?: { message: string; path: (string | number)[] }[] };
  const first = e.errors?.[0];
  return Response.json({ message: first?.message ?? "Invalid input", field: first?.path.join(".") }, { status: 400 });
}

export async function storageForRequest(request: Request) {
  const { requireUserId } = await import("./auth.server");
  return storageFor(await requireUserId(request));
}
