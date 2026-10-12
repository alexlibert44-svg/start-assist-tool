// Client-safe definitions for the Team Setup workflow (Sensei -> Hassan -> Dr Neo).
import { z } from "zod";

export const SETUP_KINDS = ["learning", "wellness", "development"] as const;
export type SetupKind = (typeof SETUP_KINDS)[number];
export const KIND_CHARACTER: Record<SetupKind, "Sensei" | "Hassan" | "Dr Neo"> = {
  learning: "Sensei", wellness: "Hassan", development: "Dr Neo",
};
export const KIND_LABEL: Record<SetupKind, string> = {
  learning: "Learning profile", wellness: "Wellness profile", development: "Personal-development profile",
};
export const KIND_DONE_MESSAGE: Record<SetupKind, string> = {
  learning: "Your learning profile is ready.",
  wellness: "Your wellness profile is ready.",
  development: "Your personal-development profile is ready.",
};

export type SetupStage = { kind: SetupKind; character: string; answers: Record<string, unknown>; completedAt: string | null; updatedAt: string | null };
export type TeamSetupState = { stages: SetupStage[]; currentStage: SetupKind | null; completedAt: string | null };

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const str = z.string().trim().min(1).max(80);
const list = (min = 1) => z.array(str).min(min, "Choose at least one option.").max(12);

export const learningSchema = z.object({
  situation: str,
  studyField: z.string().trim().max(80).optional(),
  workField: z.string().trim().max(80).optional(),
  subjects: z.array(z.object({ name: str, level: z.enum(LEVELS) })).min(1, "Add at least one subject or skill.").max(8),
  weeklyTime: str,
  preferredTimes: list(),
  goals: list(),
  preferences: list(),
});

const optNum = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label} must be a number.` }).min(min, `${label} must be between ${min} and ${max}.`).max(max, `${label} must be between ${min} and ${max}.`).optional();
export const wellnessSchema = z.object({
  ageRange: str,
  mainGoal: str,
  sex: z.string().trim().max(40).optional(),
  heightCm: optNum(100, 250, "Height (cm)"),
  weightKg: optNum(30, 300, "Weight (kg)"),
  activityLevel: str,
  exerciseTypes: list(),
  trainingDays: list(),
  exerciseTimes: list(),
  sleepGoal: z.string().trim().max(80).optional(),
  sleepHours: optNum(3, 14, "Average sleep (hours)"),
});

export const developmentSchema = z.object({
  mainGoal: str,
  habitsToBuild: list(),
  habitsToChange: list(0).optional(),
  difficulties: list(),
  focusLevel: z.number().int().min(1).max(5).optional(),
  stressLevel: z.number().int().min(1).max(5).optional(),
  sleepQuality: z.string().trim().max(40).optional(),
  reflectionTimes: list(),
});

export const SETUP_SCHEMAS = { learning: learningSchema, wellness: wellnessSchema, development: developmentSchema } as const;

/** Goals for which body measurements are actually useful. */
export const BODY_GOALS = ["Lose weight", "Build muscle"];
