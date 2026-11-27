import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import HabitsPage from "@/components/pages/habits";
import { addDays, dayName } from "@/shared/plans";

vi.mock("@/store/use-character", () => ({
  useCharacter: (select: (store: unknown) => unknown) => select({ getActiveCharacter: () => ({ theme: { gradient: "from-green-500 to-emerald-500", text: "text-primary" } }) }),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const currentLocalDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

describe("weekly habit tracker", () => {
  it("filters dated tasks by selected day and retains saved history for removed items", async () => {
    const today = currentLocalDate();
    const tomorrow = addDays(today, 1);
    const otherDate = new Date(`${tomorrow}T12:00:00Z`).getUTCDay() === 1 ? addDays(today, -1) : tomorrow;
    const dueAt = (date: string) => new Date(`${date}T15:00:00Z`).toISOString();
    const habits = [
      { id: 1, name: "Daily reading", kind: "habit", completed: false, createdAt: "2026-01-01T12:00:00Z" },
      { id: 2, name: "Today task", kind: "task", completed: false, dueAt: dueAt(today) },
      { id: 3, name: "Other day task", kind: "task", completed: false, dueAt: dueAt(otherDate) },
    ];
    const history = [{ id: 50, habitId: null, name: "Removed walk", kind: "habit", localDate: otherDate, points: 5, completedAt: dueAt(otherDate) }];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/stats") return Response.json({ points: 10, consecutiveDays: 2, today, dueToday: 2, completedToday: 0, dailyCompletionRate: 0 });
      if (url.pathname === "/api/habits/history") return Response.json(history.filter((item) => item.localDate >= (url.searchParams.get("start") ?? "") && item.localDate <= (url.searchParams.get("end") ?? "")));
      return Response.json(habits);
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><HabitsPage /></QueryClientProvider>);

    await screen.findByText("Today task");
    expect(screen.getByText("Daily reading")).toBeInTheDocument();
    expect(screen.queryByText("Other day task")).not.toBeInTheDocument();

    const dateButton = screen.getByRole("button", { name: `${dayName(otherDate)}, ${otherDate}` });
    fireEvent.click(dateButton);
    await screen.findByText("Other day task");
    expect(screen.getByText("Daily reading")).toBeInTheDocument();
    expect(screen.queryByText("Today task")).not.toBeInTheDocument();
    expect(screen.getByText("Removed walk")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Saved completion · 5 points · item removed/)).toBeInTheDocument());
    client.clear();
  });
});