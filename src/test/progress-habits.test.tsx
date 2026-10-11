import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/components/pages/progress";
import { useCreateHabit, useDeleteHabit, useUpdateHabit } from "@/hooks/use-habits";

vi.mock("@/store/use-character", () => ({
  useCharacter: (select: (store: unknown) => unknown) => select({
    getActiveCharacter: () => ({ theme: { gradient: "", text: "text-primary" } }),
  }),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Completed Habits progress card", () => {
  it("counts only daily habits and updates after ticking, unticking, adding and deleting", async () => {
    const habits = [
      { id: 1, name: "Read", kind: "habit", completed: false },
      { id: 2, name: "Exercise", kind: "habit", completed: true },
      { id: 3, name: "One-off task", kind: "task", completed: true },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split("?")[0];
      if (path === "/api/stats") return Response.json({ points: 10, consecutiveDays: 1, today: "2026-10-11", dueToday: 2, completedToday: 1, dailyCompletionRate: 50 });
      if (!init?.method) return Response.json(habits);
      if (init.method === "POST") return Response.json({ id: 4, completed: false, ...JSON.parse(String(init.body)) });
      if (init.method === "PATCH" || init.method === "PUT") return Response.json({ ...habits[0], ...JSON.parse(String(init.body)) });
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
    await waitFor(() => expect(card).toHaveTextContent("1/2"));
    expect(card).toHaveTextContent("completed today");
    await act(async () => { await update?.mutateAsync({ id: 1, completed: true }); });
    await waitFor(() => expect(card).toHaveTextContent("2/2"));
    await act(async () => { await update?.mutateAsync({ id: 1, completed: false }); });
    await waitFor(() => expect(card).toHaveTextContent("1/2"));
    await act(async () => { await create?.mutateAsync({ name: "Walk", kind: "habit" }); });
    await waitFor(() => expect(card).toHaveTextContent("1/3"));
    await act(async () => { await remove?.mutateAsync(2); });
    await waitFor(() => expect(card).toHaveTextContent("0/2"));
    await act(async () => { await remove?.mutateAsync(1); await remove?.mutateAsync(4); });
    await waitFor(() => expect(card).toHaveTextContent("0/0"));
    client.clear();
  });
});