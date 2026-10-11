import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/components/pages/progress";
import { STATS_KEY, useCreateHabit, useDeleteHabit, useUpdateHabit } from "@/hooks/use-habits";

vi.mock("@/store/use-character", () => ({
  useCharacter: (select: (store: unknown) => unknown) => select({
    getActiveCharacter: () => ({ theme: { gradient: "", text: "text-primary" } }),
  }),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Completed Habits progress card", () => {
  it("uses today's scheduled habit/task totals and refetches after changes and day rollover", async () => {
    let today = "2026-10-11";
    let habits = [
      { id: 1, name: "Read", kind: "habit", completed: false },
      { id: 2, name: "Exercise", kind: "habit", completed: true },
      { id: 3, name: "One-off task", kind: "task", completed: true, dueAt: "2026-10-11T12:00:00Z" },
      { id: 5, name: "Future task", kind: "task", completed: false, dueAt: "2026-10-12T12:00:00Z" },
      { id: 6, name: "Unscheduled task", kind: "task", completed: false },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split("?")[0];
      if (path === "/api/stats") {
        const scheduled = habits.filter(h => h.kind === "habit" || h.dueAt?.slice(0, 10) === today);
        const completed = scheduled.filter(h => h.completed).length;
        return Response.json({ points: 10, consecutiveDays: 1, today, dueToday: scheduled.length, completedToday: completed, dailyCompletionRate: scheduled.length ? Math.round(completed / scheduled.length * 100) : null });
      }
      if (!init?.method) return Response.json(habits);
      if (init.method === "POST") {
        const created = { id: 4, completed: false, ...JSON.parse(String(init.body)) };
        habits.push(created);
        return Response.json(created);
      }
      const id = Number(path?.split("/").at(-1));
      if (init.method === "PATCH" || init.method === "PUT") {
        habits = habits.map(h => h.id === id ? { ...h, ...JSON.parse(String(init.body)) } : h);
        return Response.json(habits.find(h => h.id === id));
      }
      habits = habits.filter(h => h.id !== id);
      return new Response(null, { status: 204 });
    }));
    let create: ReturnType<typeof useCreateHabit> | undefined;
    let update: ReturnType<typeof useUpdateHabit> | undefined;
    let remove: ReturnType<typeof useDeleteHabit> | undefined;
    function Harness() {
      create = useCreateHabit(); update = useUpdateHabit(); remove = useDeleteHabit();
      return <ProgressPage />;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
    const card = await screen.findByTestId("card-stat-completed-habits");
    await waitFor(() => expect(card).toHaveTextContent("2/3"));
    expect(card).toHaveTextContent("completed today");
    await act(async () => { await update?.mutateAsync({ id: 1, completed: true }); });
    await waitFor(() => expect(card).toHaveTextContent("3/3"));
    await act(async () => { await update?.mutateAsync({ id: 1, completed: false }); });
    await waitFor(() => expect(card).toHaveTextContent("2/3"));
    await act(async () => { await create?.mutateAsync({ name: "Walk", kind: "habit" }); });
    await waitFor(() => expect(card).toHaveTextContent("2/4"));
    await act(async () => { await remove?.mutateAsync(2); });
    await waitFor(() => expect(card).toHaveTextContent("1/3"));
    await act(async () => { await update?.mutateAsync({ id: 3, completed: false }); });
    await waitFor(() => expect(card).toHaveTextContent("0/3"));
    await act(async () => { await update?.mutateAsync({ id: 3, completed: true }); });
    await waitFor(() => expect(card).toHaveTextContent("1/3"));
    today = "2026-10-12";
    await act(async () => { await client.invalidateQueries({ queryKey: STATS_KEY }); });
    await waitFor(() => expect(card).toHaveTextContent("0/3"));
    await act(async () => { await remove?.mutateAsync(1); await remove?.mutateAsync(4); });
    await waitFor(() => expect(card).toHaveTextContent("0/1"));
    await act(async () => { await remove?.mutateAsync(5); });
    await waitFor(() => expect(card).toHaveTextContent("0/0"));
    expect(card).toHaveTextContent("No activities scheduled");
    client.clear();
  });
});