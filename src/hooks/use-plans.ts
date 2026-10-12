import { useQuery } from "@tanstack/react-query";
import type { Plan, PlanItem } from "@/shared/plans";

export const PLANS_KEY = ["/api/plans"];
const tz = () => `tz=${new Date().getTimezoneOffset()}`;

async function json<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? fallback);
  return body as T;
}

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: PLANS_KEY,
    refetchOnWindowFocus: true,
    queryFn: async () => json<Plan[]>(await fetch(`/api/plans?${tz()}`), "Could not load your plans."),
  });
}

export async function startPlanning() {
  return json<{ conversationId: string; resumed: boolean; hasDraft: boolean }>(
    await fetch("/api/plans/start", { method: "POST" }), "Could not start planning.");
}

export async function saveDraftItems(id: string, items: PlanItem[]) {
  return json<Plan>(await fetch(`/api/plans/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
  }), "Could not save your changes.");
}

export async function approvePlan(id: string) {
  return json<Plan>(await fetch(`/api/plans/${id}/approve?${tz()}`, { method: "POST" }), "The plan could not be saved.");
}

export async function rejectPlan(id: string) {
  const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
  if (!res.ok) await json(res, "Could not discard the proposal.");
}
