import { useQuery } from "@tanstack/react-query";
import type { SetupKind, TeamSetupState } from "@/shared/team-setup";

export const TEAM_SETUP_KEY = ["/api/team-setup"];

export async function fetchTeamSetup(): Promise<TeamSetupState> {
  const res = await fetch("/api/team-setup");
  if (!res.ok) throw new Error("Could not load Team Setup.");
  return res.json();
}

export function useTeamSetup() {
  return useQuery({ queryKey: TEAM_SETUP_KEY, queryFn: fetchTeamSetup });
}

export async function saveSetupStage(kind: SetupKind, answers: Record<string, unknown>, complete: boolean): Promise<TeamSetupState> {
  const res = await fetch(`/api/team-setup/${kind}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, complete }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? "Could not save. Please try again.");
  return body as TeamSetupState;
}
