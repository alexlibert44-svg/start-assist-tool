import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/components/pages/profile";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: 1, name: "Alex", preferredName: "Alex", primaryGoal: "", biggestChallenge: "", phoneUsage: "", currentSituation: "Student", level: 1, xp: 15, focusSessions: 0, phoneTime: 0, memberSince: "2026-01-01", onboardingStep: 7, onboardingCompleted: true } }),
  useUpdateProfile: () => ({ mutateAsync: mocks.update, isPending: false }),
}));
vi.mock("@/hooks/use-team-setup", () => ({ useTeamSetup: () => ({ data: { stages: [
  { kind: "learning", answers: { subjects: ["Spanish"] }, completedAt: "2026-01-01" },
  { kind: "wellness", answers: {}, completedAt: null },
  { kind: "development", answers: {}, completedAt: null },
] } }) }));
vi.mock("@/hooks/use-habits", () => ({ useHabits: () => ({ data: [{ id: 1, kind: "habit" }] }), useStats: () => ({ data: { points: 15, consecutiveDays: 2, dailyCompletionRate: null } }) }));
vi.mock("@/hooks/use-plans", () => ({ usePlans: () => ({ data: [] }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("profile settings", () => {
  it("saves goal preferences through the existing profile update service", async () => {
    mocks.update.mockResolvedValue({});
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ProfilePage /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Settings & Personal Information" }));
    fireEvent.click(screen.getByText("Goals and Preferences"));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Primary goal"), { target: { value: "Improve discipline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ primaryGoal: "Improve discipline" })));
    expect(screen.getByText("Learning Profile")).toBeInTheDocument();
    expect(screen.getByText("Schedule and Availability")).toBeInTheDocument();
    client.clear();
  });
});