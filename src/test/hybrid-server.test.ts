import { beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_QUESTIONS } from "@/shared/onboarding-questions";
import { FIELDS } from "@/shared/question-fields";
import { questionSchema } from "@/shared/agent-questions";

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), generate: vi.fn(), auth: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/server/auth.server", () => ({ requireUserId: mocks.auth }));
vi.mock("@/server/agent-questions.server", () => ({ readWorkflow: mocks.read, writeWorkflow: mocks.write, generateQuestions: mocks.generate, QuestionError: class extends Error { status = 402; } }));
import { Route } from "@/routes/api/agent-questions";
const handlers = (Route as unknown as { server: { handlers: Record<string, (ctx: { request: Request }) => Promise<Response>> } }).server.handlers;
async function call(method: string, body: unknown) {
  const handler = handlers[method]; if (!handler) throw new Error("Missing handler");
  return handler({ request: new Request("http://localhost/api/agent-questions", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue("fixture-user"); mocks.read.mockResolvedValue(null); mocks.write.mockImplementation(async (_uid, _workflow, state) => state);
});
describe("Hybrid question server boundary", () => {
  it("rejects initial AI generation even with an authenticated caller", async () => {
    const response = await call("POST", { workflow: "onboarding", key: "preferredName" });
    expect(response.status).toBe(400); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("persists trusted initial definitions and drafts for the authenticated user", async () => {
    const response = await call("PUT", { workflow: "onboarding", state: { questions: [], answers: { preferredName: "Tester" }, step: 1 } });
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith("fixture-user", "onboarding", { questions: ONBOARDING_QUESTIONS, answers: { preferredName: "Tester" }, step: 1 });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("retains validated specialist personalization when saving base-question answers", async () => {
    const field = FIELDS.learning[0]; if (!field) throw new Error("Missing field");
    const personalized = questionSchema.parse({ ...field, label: "Tell Sensei about your learning situation", options: field.options ?? [], optional: !!field.optional, custom: !!field.custom });
    mocks.read.mockResolvedValue({ questions: [personalized], answers: {}, step: 0 });
    const response = await call("PUT", { workflow: "learning", state: { questions: [], answers: { [field.key]: "Student" }, step: 1 } });
    expect(response.status).toBe(200);
    expect((await response.json()).questions[0]).toEqual(personalized);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});