import { z } from "zod";
import { questionSchema, type AgentQuestion } from "./agent-questions";

export const ONBOARDING_QUESTIONS: AgentQuestion[] = [
  { key: "preferredName", label: "What is your name?", type: "text", options: [], optional: false, custom: false },
  { key: "primaryGoal", label: "What is your primary goal?", type: "single", options: ["Improve discipline", "Learn new skills", "Improve physical wellness", "Build positive habits", "Other"], optional: false, custom: true },
  { key: "biggestChallenge", label: "What is your biggest current challenge?", type: "single", options: ["Procrastination", "Lack of focus", "Poor time management", "Inconsistency", "Other"], optional: false, custom: true },
  { key: "phoneUsage", label: "How much time do you spend on your phone daily?", type: "single", options: ["Less than 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"], optional: false, custom: false },
  { key: "currentSituation", label: "What best describes your current situation?", type: "single", options: ["Student", "Employed", "Self-employed", "Independent learner", "Other"], optional: false, custom: true },
].map((q) => questionSchema.parse(q));
export const initialProfileSchema = z.object({
  preferredName: z.string().trim().min(1).max(40),
  primaryGoal: z.string().trim().min(1).max(80).refine((v) => v !== "Other", "Please describe your goal."),
  biggestChallenge: z.string().trim().min(1).max(80).refine((v) => v !== "Other", "Please describe your challenge."),
  phoneUsage: z.enum(["Less than 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"]),
  currentSituation: z.string().trim().min(1).max(80).refine((v) => v !== "Other", "Please describe your situation."),
});
export function initialAnswerValid(q: AgentQuestion, value: unknown): boolean {
  const field = initialProfileSchema.shape[q.key as keyof typeof initialProfileSchema.shape];
  return !!field && field.safeParse(value).success;
}