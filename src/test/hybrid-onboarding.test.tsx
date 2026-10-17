import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_QUESTIONS, initialAnswerValid, initialProfileSchema } from "@/shared/onboarding-questions";
import { AgentQuestionStep } from "@/components/agent-question";

const state = vi.hoisted(() => ({ profile: { preferredName: "", primaryGoal: "", biggestChallenge: "", phoneUsage: "", currentSituation: "", onboardingStep: 0, onboardingCompleted: false }, mutate: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: state.profile, isLoading: false }), useUpdateProfile: () => ({ mutateAsync: state.mutate, isPending: false }) }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options, useNavigate: () => vi.fn() }));
vi.mock("framer-motion", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/use-conversations", () => ({ fetchConversations: async () => [{ id: "existing" }], createConversationRequest: vi.fn() }));
import { Onboarding } from "@/routes/_authenticated/onboarding";

let workflow: { questions: typeof ONBOARDING_QUESTIONS; answers: Record<string, unknown>; step: number } | null;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  workflow = null;
  state.profile = { preferredName: "", primaryGoal: "", biggestChallenge: "", phoneUsage: "", currentSituation: "", onboardingStep: 0, onboardingCompleted: false };
  state.mutate.mockReset().mockImplementation(async (patch) => { state.profile = { ...state.profile, ...patch }; return state.profile; });
  fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") { workflow = JSON.parse(String(init.body)).state; return Response.json(workflow); }
    return Response.json(_url.includes("stats") ? {} : workflow);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Hybrid onboarding", () => {
  it("keeps five ordered required application questions and validates Other and phone ranges", () => {
    expect(ONBOARDING_QUESTIONS.map((q) => q.key)).toEqual(["preferredName", "primaryGoal", "biggestChallenge", "phoneUsage", "currentSituation"]);
    expect(ONBOARDING_QUESTIONS.every((q) => !q.optional)).toBe(true);
    const name = ONBOARDING_QUESTIONS[0]; const goal = ONBOARDING_QUESTIONS[1];
    if (!name || !goal) throw new Error("Missing question");
    expect(initialAnswerValid(name, " ")).toBe(false);
    expect(initialAnswerValid(name, "a".repeat(41))).toBe(false);
    expect(initialAnswerValid(goal, "Other")).toBe(false);
    expect(initialAnswerValid(goal, "Learn pottery")).toBe(true);
    expect(initialProfileSchema.safeParse({ preferredName: "Test", primaryGoal: "Learn pottery", biggestChallenge: "Lack of focus", phoneUsage: "invalid", currentSituation: "Student" }).success).toBe(false);
  });
  it("renders without AI, preserves Back and refresh drafts, and completes the saved profile", async () => {
    const view = render(<Onboarding />);
    await screen.findByRole("textbox", { name: "What is your name?" });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hybrid Tester" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("radio", { name: "Improve discipline" });
    fireEvent.click(screen.getByRole("radio", { name: "Improve discipline" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("radio", { name: "Lack of focus" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Improve discipline" })).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("radio", { name: "Lack of focus" });
    fireEvent.click(screen.getByRole("radio", { name: "Lack of focus" }));
    await waitFor(() => expect(workflow?.answers["biggestChallenge"]).toBe("Lack of focus"), { timeout: 2000 });
    view.unmount(); render(<Onboarding />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Lack of focus" })).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("radio", { name: "2–4 hours" });
    fireEvent.click(screen.getByRole("radio", { name: "2–4 hours" })); fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("radio", { name: "Student" });
    fireEvent.click(screen.getByRole("radio", { name: "Student" })); fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(state.profile.onboardingCompleted).toBe(true));
    expect(state.profile).toMatchObject({ preferredName: "Hybrid Tester", primaryGoal: "Improve discipline", biggestChallenge: "Lack of focus", phoneUsage: "2–4 hours", currentSituation: "Student" });
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
  it("keeps specialist base questions usable after a credit failure", async () => {
    const q = ONBOARDING_QUESTIONS[1]; if (!q) throw new Error("Missing question");
    fetcher.mockResolvedValue(Response.json({ message: "Not enough credits" }, { status: 402 }));
    const ready = vi.fn();
    render(<AgentQuestionStep baseQuestion={q} workflow="learning" fieldKey={q.key} answers={{}} value="Improve discipline" onChange={vi.fn()} onReady={ready} />);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Personalize with AI" }));
    await screen.findByRole("status");
    expect(screen.getByRole("radio", { name: "Improve discipline" })).toHaveAttribute("aria-checked", "true");
    expect(ready).toHaveBeenLastCalledWith(q);
  });
});