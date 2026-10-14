import { z } from "zod";

export const QUESTION_TYPES = ["single", "multi", "text", "number", "scale", "subjects"] as const;
export const questionSchema = z.object({
  key: z.string().min(1).max(50), label: z.string().min(1).max(240),
  type: z.enum(QUESTION_TYPES), options: z.array(z.string().min(1).max(80)).max(12),
  optional: z.boolean(),
}).superRefine((q, ctx) => {
  if ((q.type === "single" || q.type === "multi") && q.options.length < 2)
    ctx.addIssue({ code: "custom", message: "Choices are missing." });
  if (new Set(q.options).size !== q.options.length)
    ctx.addIssue({ code: "custom", message: "Choices must be unique." });
});
export const questionsSchema = z.object({ questions: z.array(questionSchema).max(16) });
export type AgentQuestion = z.infer<typeof questionSchema>;
export type Answer = string | number | string[] | { name: string; level: string }[];
export const WORKFLOWS = ["onboarding", "learning", "wellness", "development", "planning"] as const;
export type Workflow = typeof WORKFLOWS[number];
export const workflowStateSchema = z.object({
  questions: z.array(questionSchema).max(16), answers: z.record(z.unknown()), step: z.number().int().min(0).max(16),
});
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export function answerValid(q: AgentQuestion, value: unknown): boolean {
  if (q.optional && (value === undefined || value === "" || (Array.isArray(value) && !value.length))) return true;
  if (q.type === "multi") return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string" && v.trim().length > 0 && v.length <= 80);
  if (q.type === "subjects") return Array.isArray(value) && value.length > 0 && value.every((v) => v && typeof v.name === "string" && v.name.trim() && ["Beginner", "Intermediate", "Advanced"].includes(v.level));
  if (q.type === "number" || q.type === "scale") return typeof value === "number" && Number.isFinite(value) && (q.type !== "scale" || (value >= 1 && value <= 5));
  return typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
}