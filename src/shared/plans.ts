// Weekly plan model shared by the API, Larry's planning tools and the UI.
export const PLAN_CATEGORIES = ["learning", "fitness", "development", "habit", "commitment", "other"] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];
export const PLAN_CHARACTERS = ["Larry", "Sensei", "Hassan", "Dr Neo"] as const;
export type PlanCharacter = (typeof PLAN_CHARACTERS)[number];

export type PlanItem = {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD (user's local date)
  day: string; // Monday..Sunday
  start: string; // HH:MM
  end: string; // HH:MM
  durationMinutes: number;
  category: PlanCategory;
  character: PlanCharacter;
  habitId: number | null; // linked habit/task record (set for habits at proposal, for tasks at approval)
  completed: boolean; // derived from the linked record when read
  planVersion: number;
};

export type Plan = {
  id: string; name: string; description: string | null; status: "draft" | "active" | "archived" | string;
  startDate: string | null; endDate: string | null; createdAt: string; updatedAt: string;
  approvedAt: string | null; version: number; conversationId: string | null;
  schedule: PlanItem[];
};

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const dayName = (date: string) => DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? "";
export const addDays = (date: string, n: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? NaN : h * 60 + mi;
};
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export type RawItem = Partial<Omit<PlanItem, "habitId">> & { habitId?: number | null; habit_id?: number | null };

/** Normalizes and validates a 7-day schedule. Returns items or human-readable errors. */
export function normalizeSchedule(raw: RawItem[], startDate: string, version: number): { items: PlanItem[]; errors: string[] } {
  const errors: string[] = [];
  const endDate = addDays(startDate, 6);
  const items: PlanItem[] = [];
  raw.forEach((r, i) => {
    const label = `Activity ${i + 1}${r.title ? ` ("${r.title}")` : ""}`;
    const title = String(r.title ?? "").trim();
    const date = String(r.date ?? "");
    const s = toMin(String(r.start ?? ""));
    let dur = Number(r.durationMinutes);
    if (!Number.isFinite(dur) && r.end) dur = toMin(String(r.end)) - s;
    if (!title) errors.push(`${label}: missing title.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < startDate || date > endDate) errors.push(`${label}: date must be between ${startDate} and ${endDate}.`);
    if (!Number.isFinite(s)) errors.push(`${label}: invalid start time (use HH:MM).`);
    if (!Number.isFinite(dur) || dur < 5 || dur > 600) errors.push(`${label}: duration must be 5–600 minutes.`);
    else if (Number.isFinite(s) && s + dur > 24 * 60) errors.push(`${label}: must end before midnight.`);
    const category = (PLAN_CATEGORIES as readonly string[]).includes(String(r.category)) ? (r.category as PlanCategory) : "other";
    const character = (PLAN_CHARACTERS as readonly string[]).includes(String(r.character)) ? (r.character as PlanCharacter) : "Larry";
    const hid = r.habitId ?? r.habit_id ?? null;
    items.push({
      id: r.id && typeof r.id === "string" ? r.id : crypto.randomUUID(),
      title, description: String(r.description ?? "").trim(), date, day: dayName(date),
      start: Number.isFinite(s) ? fromMin(s) : "", end: Number.isFinite(s + dur) ? fromMin(s + dur) : "",
      durationMinutes: Math.round(dur), category, character,
      habitId: typeof hid === "number" && Number.isInteger(hid) ? hid : null, completed: false, planVersion: version,
    });
  });
  if (!errors.length) {
    const byDate = new Map<string, PlanItem[]>();
    for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);
    for (const list of byDate.values()) {
      list.sort((a, b) => toMin(a.start) - toMin(b.start));
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1]!, b = list[i]!;
        if (toMin(b.start) < toMin(a.start) + a.durationMinutes) errors.push(`"${a.title}" and "${b.title}" overlap on ${a.day} ${a.date}.`);
      }
    }
  }
  items.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { items, errors };
}
