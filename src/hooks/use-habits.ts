import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertHabit } from "@/shared/routes";
import type { Habit } from "@/shared/schema";

const HABITS_KEY = [api.habits.list.path];
const PROFILE_KEY = [api.profile.get.path];
export const STATS_KEY = ["/api/stats"];
const tzq = () => `tz=${new Date().getTimezoneOffset()}`;
const withTz = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${tzq()}`;
// Re-read on focus and every minute so "today" rolls over after local midnight.
const LIVE = { refetchOnWindowFocus: true, refetchInterval: 60_000 } as const;

export type Stats = {
  points: number; consecutiveDays: number; today: string;
  dueToday: number; completedToday: number; dailyCompletionRate: number | null;
};

export function useStats() {
  return useQuery<Stats>({
    queryKey: STATS_KEY,
    ...LIVE,
    queryFn: async () => {
      const res = await fetch(withTz("/api/stats"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return (await res.json()) as Stats;
    },
  });
}

export function useHabits() {
  return useQuery<Habit[]>({
    queryKey: HABITS_KEY,
    ...LIVE,
    queryFn: async () => {
      const res = await fetch(withTz(api.habits.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch habits");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected habits response");
      return data as Habit[];
    },
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertHabit) => {
      const validated = api.habits.create.input.parse(data);
      const res = await fetch(withTz(api.habits.create.path), {
        method: api.habits.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create habit");
      return (await res.json()) as Habit;
    },
    onSuccess: (newHabit) => {
      // Immediately insert the new habit into the cache so the list
      // and completion rate update without waiting for a background refetch.
      queryClient.setQueryData<Habit[]>(HABITS_KEY, (old) =>
        old ? [...old, newHabit] : [newHabit]
      );
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertHabit>) => {
      const validated = api.habits.update.input.parse(updates);
      const url = buildUrl(api.habits.update.path, { id });
      const res = await fetch(withTz(url), {
        method: api.habits.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update habit");
      return (await res.json()) as Habit;
    },
    onSuccess: (updatedHabit) => {
      // Replace just the updated habit in the cache — instant UI update.
      queryClient.setQueryData<Habit[]>(HABITS_KEY, (old) =>
        old
          ? old.map((h) => (h.id === updatedHabit.id ? updatedHabit : h))
          : [updatedHabit]
      );
      // Profile score changed — refetch it.
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.habits.delete.path, { id });
      const res = await fetch(withTz(url), {
        method: api.habits.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete habit");
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove the deleted habit from the cache immediately.
      queryClient.setQueryData<Habit[]>(HABITS_KEY, (old) =>
        old ? old.filter((h) => h.id !== deletedId) : []
      );
      // Profile score may have changed (if habit was completed) — refetch it.
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}
