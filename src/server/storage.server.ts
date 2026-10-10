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
};

const toMsg = (r: MsgRow) =>
  ({ id: r.id, content: r.content, sender: r.sender, characterId: r.character_id, createdAt: r.created_at }) as unknown as Message;
const toProf = (r: ProfRow) =>
  ({
    id: r.id, name: r.name, level: r.level, xp: r.xp, focusSessions: r.focus_sessions,
    phoneTime: r.phone_time, memberSince: r.member_since,
  }) as unknown as Profile;

function profToRow(u: Partial<InsertProfile>) {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row["name"] = u.name;
  if (u.level !== undefined) row["level"] = u.level;
  if (u.xp !== undefined) row["xp"] = u.xp;
  if (u.focusSessions !== undefined) row["focus_sessions"] = u.focusSessions;
  if (u.phoneTime !== undefined) row["phone_time"] = u.phoneTime;
  return row;
}

type HabitRow = {
  id: number; name: string; completed: boolean | null; streak: number | null; due_at: string | null;
  linked_character: string | null; points_awarded: boolean; completed_at: string | null; created_at: string | null;
};
const toHabit = (r: HabitRow) =>
  ({
    id: r.id, name: r.name, completed: r.completed, streak: r.streak, dueAt: r.due_at,
    linkedCharacter: r.linked_character, pointsAwarded: r.points_awarded, completedAt: r.completed_at, createdAt: r.created_at,
  }) as Habit;
function habitToRow(u: Partial<InsertHabit>) {
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row["name"] = u.name;
  if (u.completed !== undefined) row["completed"] = u.completed;
  if (u.streak !== undefined) row["streak"] = u.streak;
  if (u.dueAt !== undefined) row["due_at"] = u.dueAt;
  if (u.linkedCharacter !== undefined) row["linked_character"] = u.linkedCharacter;
  return row;
}

async function adjustScore(delta: number) {
  const prof = await storage.getProfile();
  const newScore = Math.max(0, (prof?.xp ?? 0) + delta);
  await storage.updateProfile({ xp: newScore, level: calcLevel(newScore) });
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const storage = {
  async getMessages(characterId?: string): Promise<Message[]> {
    const c = await db();
    let q = c.from("messages").select("*").order("id");
    if (characterId) q = q.eq("character_id", characterId);
    return (check(await q) as MsgRow[]).map(toMsg);
  },
  async createMessage(m: InsertMessage): Promise<Message> {
    const c = await db();
    const row = check(
      await c.from("messages").insert({ content: m.content, sender: m.sender, character_id: m.characterId }).select().single(),
    );
    return toMsg(row as MsgRow);
  },
  async clearMessages(characterId: string): Promise<void> {
    const c = await db();
    check(await c.from("messages").delete().eq("character_id", characterId));
  },
  async getHabits(): Promise<Habit[]> {
    const c = await db();
    return (check(await c.from("habits").select("*").order("id")) as HabitRow[]).map(toHabit);
  },
  async getHabit(id: number): Promise<Habit | undefined> {
    const c = await db();
    const rows = check(await c.from("habits").select("*").eq("id", id)) as HabitRow[];
    return rows[0] ? toHabit(rows[0]) : undefined;
  },
  async createHabit(h: InsertHabit): Promise<Habit> {
    const c = await db();
    const row = habitToRow(h);
    if (row["completed"]) { row["points_awarded"] = false; }
    const created = toHabit(check(await c.from("habits").insert(row as { name: string }).select().single()) as HabitRow);
    if (created.completed) return (await storage.setCompletion(created.id, true)) ?? created;
    return created;
  },
  // Updates non-completion fields; completion goes through setCompletion so points stay consistent.
  async updateHabit(id: number, u: Partial<InsertHabit>): Promise<Habit | undefined> {
    const c = await db();
    const { completed, ...rest } = u;
    const row = habitToRow(rest);
    if (Object.keys(row).length > 0) {
      const rows = check(await c.from("habits").update(row).eq("id", id).select()) as HabitRow[];
      if (!rows[0]) return undefined;
    }
    if (completed !== undefined) return storage.setCompletion(id, completed);
    return storage.getHabit(id);
  },
  // Idempotent: points are awarded only on the transition points_awarded false -> true (atomic conditional update).
  async setCompletion(id: number, done: boolean): Promise<Habit | undefined> {
    const c = await db();
    if (done) {
      const rows = check(
        await c.from("habits")
          .update({ completed: true, points_awarded: true, completed_at: new Date().toISOString() })
          .eq("id", id).eq("points_awarded", false).select(),
      ) as HabitRow[];
      if (rows[0]) await adjustScore(SCORE_PER_HABIT);
    } else {
      const rows = check(
        await c.from("habits").update({ completed: false, points_awarded: false, completed_at: null })
          .eq("id", id).eq("points_awarded", true).select(),
      ) as HabitRow[];
      if (rows[0]) await adjustScore(-SCORE_PER_HABIT);
      else check(await c.from("habits").update({ completed: false }).eq("id", id).select());
    }
    return storage.getHabit(id);
  },
  async deleteHabit(id: number): Promise<boolean> {
    const c = await db();
    const rows = check(await c.from("habits").delete().eq("id", id).select()) as HabitRow[];
    if (rows[0]?.points_awarded) await adjustScore(-SCORE_PER_HABIT);
    return rows.length > 0;
  },
  async getProfile(): Promise<Profile | undefined> {
    const c = await db();
    const rows = check(await c.from("profile").select("*").order("id").limit(1)) as ProfRow[];
    return rows[0] ? toProf(rows[0]) : undefined;
  },
  async updateProfile(u: Partial<InsertProfile>): Promise<Profile> {
    const c = await db();
    const existing = await storage.getProfile();
    if (!existing) {
      const row = check(
        await c.from("profile").insert({ ...profToRow(u), name: u.name || "User" } as { name: string }).select().single(),
      );
      return toProf(row as ProfRow);
    }
    const row = check(await c.from("profile").update(profToRow(u) as { name?: string }).eq("id", existing.id).select().single());
    return toProf(row as ProfRow);
  },
};

export const SCORE_PER_HABIT = 10;
export function calcLevel(score: number): number {
  if (score >= 600) return 4;
  if (score >= 300) return 3;
  if (score >= 100) return 2;
  return 1;
}

export function zodError(err: unknown) {
  const e = err as { errors?: { message: string; path: (string | number)[] }[] };
  const first = e.errors?.[0];
  return Response.json({ message: first?.message ?? "Invalid input", field: first?.path.join(".") }, { status: 400 });
}
