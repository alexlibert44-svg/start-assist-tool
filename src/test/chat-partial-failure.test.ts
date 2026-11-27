import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockPlanError extends Error { status = 400; }
  return {
    owner: vi.fn(),
    storageFor: vi.fn(),
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    getMessages: vi.fn(),
    profileContext: vi.fn(),
    getDraft: vi.fn(),
    listPlans: vi.fn(),
    generateQuestions: vi.fn(),
    createHabit: vi.fn(),
    getHabits: vi.fn(),
    getProfile: vi.fn(),
    MockPlanError,
  };
});

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (value: unknown) => value }));
vi.mock("@/server/conversations.server", () => ({
  ownerFromRequest: mocks.owner,
  conversations: { listConversations: mocks.listConversations, getConversation: mocks.getConversation, getMessages: mocks.getMessages },
}));
vi.mock("@/server/storage.server", () => ({ storageFor: mocks.storageFor, localDate: () => "2026-11-24" }));
vi.mock("@/server/team-setup.server", () => ({ profileContext: mocks.profileContext }));
vi.mock("@/server/plans.server", () => ({ getDraft: mocks.getDraft, listPlans: mocks.listPlans, PlanError: mocks.MockPlanError, saveDraft: vi.fn() }));
vi.mock("@/server/agent-questions.server", () => ({ generateQuestions: mocks.generateQuestions }));

import { Route } from "@/routes/api/chat";
const handler = (Route as unknown as { server: { handlers: { POST: (context: { request: Request }) => Promise<Response> } } }).server.handlers.POST;

const toolCall = () => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", function: { name: "create_task", arguments: JSON.stringify({ name: "Read chapter" }) } }] } }] })}\n\ndata: [DONE]\n\n`;
const textReply = () => `data: ${JSON.stringify({ choices: [{ delta: { content: "I could not finish the save." } }] })}\n\ndata: [DONE]\n\n`;

async function post() {
  return handler({ request: new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Add a task to read a chapter", character: "Larry", history: [] }) }) });
}

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-key");
  mocks.owner.mockResolvedValue({ userId: "owner-a" });
  mocks.listConversations.mockResolvedValue([]);
  mocks.getConversation.mockResolvedValue(undefined);
  mocks.getMessages.mockResolvedValue([]);
  mocks.profileContext.mockResolvedValue("");
  mocks.getDraft.mockResolvedValue(null);
  mocks.listPlans.mockResolvedValue([]);
  mocks.generateQuestions.mockResolvedValue([]);
  mocks.getHabits.mockResolvedValue([]);
  mocks.getProfile.mockResolvedValue(null);
  mocks.createHabit.mockResolvedValue({ id: 7, name: "Read chapter", kind: "task", completed: false });
  mocks.storageFor.mockReturnValue({ getHabits: mocks.getHabits, getProfile: mocks.getProfile, createHabit: mocks.createHabit });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("chat provider failure after tool execution", () => {
  it("returns refresh flags when a task saved before the next AI call failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(toolCall(), { status: 200 })).mockResolvedValueOnce(new Response("insufficient credits", { status: 402 })));
    const response = await post();
    const body = await response.json();
    expect(mocks.createHabit).toHaveBeenCalledTimes(1);
    expect(body.dataChanged).toBe(true);
    expect(body.saveUncertain).toBe(false);
  });

  it("marks the data state uncertain when a mutation request fails before confirmation", async () => {
    mocks.createHabit.mockRejectedValueOnce(new Error("save interrupted"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(toolCall(), { status: 200 })).mockResolvedValueOnce(new Response(textReply(), { status: 200 })));
    const response = await post();
    const body = await response.json();
    expect(body.dataChanged).toBe(true);
    expect(body.saveUncertain).toBe(true);
  });
});