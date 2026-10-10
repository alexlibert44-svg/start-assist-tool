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
    return check(await c.from("habits").select("*").order("id")) as Habit[];
  },
  async createHabit(h: InsertHabit): Promise<Habit> {
    const c = await db();
    return check(await c.from("habits").insert(h).select().single()) as Habit;
  },
  async updateHabit(id: number, u: Partial<InsertHabit>): Promise<Habit | undefined> {
    const c = await db();
    const rows = check(await c.from("habits").update(u).eq("id", id).select()) as Habit[];
    return rows[0];
  },
  async deleteHabit(id: number): Promise<boolean> {
    const c = await db();
    const rows = check(await c.from("habits").delete().eq("id", id).select()) as Habit[];
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
