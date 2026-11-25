// Plan data access. Statuses: draft (Larry's proposal, editable) -> active (approved) -> archived.
// At most one draft and one active plan per user. Approval links every activity to a real habit/task record.
import { addDays, normalizeSchedule, type Plan, type PlanItem, type RawItem } from "@/shared/plans";
import { localDate, storageFor } from "./storage.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export class PlanError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

type Row = {
  id: string; name: string; description: string | null; status: string; start_date: string | null; end_date: string | null;
  schedule: unknown; created_at: string; updated_at: string; approved_at: string | null; version: number; conversation_id: string | null;
};
const toPlan = (r: Row): Plan => ({
  id: r.id, name: r.name, description: r.description, status: r.status, startDate: r.start_date, endDate: r.end_date,
  schedule: (Array.isArray(r.schedule) ? r.schedule : []) as PlanItem[], createdAt: r.created_at, updatedAt: r.updated_at,
  approvedAt: r.approved_at, version: r.version, conversationId: r.conversation_id,
});

/** Lists plans with completion status read from the linked habit/task records. */
export async function listPlans(uid: string, tz = 0): Promise<Plan[]> {
  const c = await db();
  const { data, error } = await c.from("plans").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const plans = (data as Row[]).map(toPlan);
  const habits = await storageFor(uid).getHabits(tz);
  const byId = new Map(habits.map((h) => [h.id, h]));
  const habitIds = habits.filter((h) => h.kind !== "task").map((h) => h.id);
  const done = new Set<string>();
  if (habitIds.length) {
    const comp = await c.from("habit_completions").select("habit_id, local_date").eq("user_id", uid).in("habit_id", habitIds);
    if (comp.error) throw new Error(comp.error.message);
    for (const r of comp.data ?? []) done.add(`${r.habit_id}|${r.local_date}`);
  }
  for (const p of plans) {
    p.schedule = p.schedule.map((it) => {
      const h = it.habitId != null ? byId.get(it.habitId) : undefined;
      const completed = !h ? false : h.kind === "task" ? !!h.completed : done.has(`${h.id}|${it.date}`);
      return { ...it, completed };
    });
  }
  return plans;
}

async function getPlanRow(uid: string, id: string): Promise<Row | null> {
  const c = await db();
  const { data, error } = await c.from("plans").select("*").eq("user_id", uid).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

export async function getDraft(uid: string): Promise<Plan | null> {
  const c = await db();
  const { data, error } = await c.from("plans").select("*").eq("user_id", uid).eq("status", "draft").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? toPlan(data[0] as Row) : null;
}

/** Creates or replaces the user's single draft (proposal). Habit links must reference the user's real daily habits. */
export async function saveDraft(uid: string, input: { name?: string; description?: string; startDate: string; items: RawItem[]; conversationId?: string | null }): Promise<Plan> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new PlanError("start_date must be YYYY-MM-DD.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new PlanError("The plan needs at least one activity.");
  if (input.items.length > 80) throw new PlanError("Too many activities for one week (max 80).");
  const existing = await getDraft(uid);
  const version = (existing?.version ?? 0) + 1;
  const { items, errors } = normalizeSchedule(input.items, input.startDate, version);
  const habits = await storageFor(uid).getHabits();
  const habitIds = new Set(habits.map((h) => h.id));
  for (const it of items) if (it.habitId != null && !habitIds.has(it.habitId)) errors.push(`"${it.title}": linked habit ${it.habitId} does not exist.`);
  if (errors.length) throw new PlanError(errors.join(" "));
  const c = await db();
  const row = {
    name: input.name?.trim() || existing?.name || "My First Week", description: input.description?.trim() ?? existing?.description ?? null,
    start_date: input.startDate, end_date: addDays(input.startDate, 6), schedule: items as never, version,
    conversation_id: input.conversationId ?? existing?.conversationId ?? null, updated_at: new Date().toISOString(),
  };
  const res = existing
    ? await c.from("plans").update(row).eq("id", existing.id).eq("user_id", uid).eq("status", "draft").select().single()
    : await c.from("plans").insert({ ...row, user_id: uid, status: "draft" }).select().single();
  if (res.error) throw new Error(res.error.message);
  return toPlan(res.data as Row);
}

/** User edits from the review screen — same validation as Larry's proposal. */
export async function updateDraft(uid: string, id: string, items: RawItem[]): Promise<Plan> {
  return updatePlanSchedule(uid, id, items);
}

/** Updates a draft or an active plan and synchronizes its linked tasks atomically. */
export async function updatePlanSchedule(uid: string, id: string, rawItems: RawItem[], tz = 0): Promise<Plan> {
  const row = await getPlanRow(uid, id);
  if (!row) throw new PlanError("Plan not found.", 404);
  if (row.status !== "draft" && row.status !== "active") throw new PlanError("This plan is no longer editable.", 409);
  if (!row.start_date) throw new PlanError("This plan has no start date and cannot be edited.", 409);
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new PlanError("The plan needs at least one activity.");
  if (rawItems.length > 80) throw new PlanError("Too many activities for one week (max 80).");
  const version = row.version + 1;
  const { items, errors } = normalizeSchedule(rawItems, row.start_date, version);
  const habits = await storageFor(uid).getHabits(tz);
  const habitIds = new Set(habits.map((h) => h.id));
  for (const it of items) if (it.habitId != null && !habitIds.has(it.habitId)) errors.push(`"${it.title}": linked activity ${it.habitId} does not exist.`);
  if (errors.length) throw new PlanError(errors.join(" "));
  const c = await db();
  const result = await c.rpc("save_plan_schedule_atomic", {
    p_user_id: uid, p_plan_id: id, p_items: items as never, p_tz_offset_minutes: tz, p_expected_version: row.version,
  });
  if (result.error) throwPlanRpcError(result.error);
  return toPlan(result.data as unknown as Row);
}

export async function rejectDraft(uid: string, id: string): Promise<void> {
  const c = await db();
  const { error } = await c.from("plans").delete().eq("id", id).eq("user_id", uid).eq("status", "draft");
  if (error) throw new Error(error.message);
}

/** Approves a draft exactly once: claims it, creates one task per unlinked activity, archives the previous active plan. */
export async function approveDraft(uid: string, id: string, tz = 0): Promise<Plan> {
  const c = await db();
  const result = await c.rpc("approve_plan_atomic", { p_user_id: uid, p_plan_id: id, p_tz_offset_minutes: tz });
  if (result.error) throwPlanRpcError(result.error);
  return toPlan(result.data as unknown as Row);
}

function throwPlanRpcError(error: { message: string; code?: string }): never {
  if (error.message.includes("PLAN_NOT_FOUND") || error.code === "P0002") throw new PlanError("Plan not found.", 404);
  if (error.message.includes("PLAN_ACTIVITY_LINK_INVALID")) throw new PlanError("A linked activity no longer exists. Your plan was not changed.", 409);
  if (error.message.includes("PLAN_VERSION_CONFLICT")) throw new PlanError("This plan changed elsewhere. Refresh it before saving again.", 409);
  if (error.message.includes("PLAN_NOT_EDITABLE") || error.message.includes("PLAN_NOT_APPROVABLE") || error.code === "40001") {
    throw new PlanError("This plan is no longer in a state that can be changed.", 409);
  }
  throw new Error(error.message);
}

export { localDate };
