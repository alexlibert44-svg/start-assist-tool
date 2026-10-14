import { BODY_GOALS, type SetupKind } from "@/shared/team-setup";
type A = Record<string, unknown>;
export type Field = {
  key: string; label: string; type: "single" | "multi" | "number" | "text" | "scale" | "subjects";
  options?: string[]; optional?: boolean; why?: string; unit?: string; custom?: boolean; showIf?: (a: A) => boolean;
};

const TIMES = ["Early morning", "Morning", "Afternoon", "Evening", "Late night"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const FIELDS: Record<SetupKind, Field[]> = {
  learning: [
    { key: "situation", label: "What is your current situation?", type: "single", options: ["Student", "Working", "Independent learner", "Working and studying", "Other"] },
    { key: "studyField", label: "What are you studying?", type: "text", optional: true, showIf: (a) => a["situation"] === "Student" || a["situation"] === "Working and studying" },
    { key: "workField", label: "What field do you work in?", type: "text", optional: true, showIf: (a) => a["situation"] === "Working" || a["situation"] === "Working and studying" },
    { key: "subjects", label: "Which subjects or skills do you want to learn, and what is your level in each?", type: "subjects" },
    { key: "weeklyTime", label: "How much time can you give to learning each week?", type: "single", options: ["Less than 2 hours", "2–5 hours", "5–10 hours", "10–15 hours", "More than 15 hours"] },
    { key: "preferredTimes", label: "When do you prefer to learn?", type: "multi", options: TIMES },
    { key: "goals", label: "What are your main learning goals?", type: "multi", custom: true, options: ["Pass an exam", "Get a new job or promotion", "Build a project", "Personal interest", "Earn a certificate"] },
    { key: "preferences", label: "How do you like to learn?", type: "multi", options: ["Reading", "Listening", "Videos", "Exercises", "Practical projects"] },
  ],
  wellness: [
    { key: "mainGoal", label: "What is your main physical or wellness goal?", type: "single", options: ["Lose weight", "Build muscle", "Improve fitness", "More energy", "Better sleep", "Reduce stiffness / move more"] },
    { key: "ageRange", label: "Your age range", type: "single", options: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"], why: "Helps Hassan keep general guidance appropriate for your age." },
    { key: "sex", label: "Sex (optional)", type: "single", optional: true, options: ["Female", "Male", "Prefer not to say"], why: "Only asked because your goal relates to body composition.", showIf: (a) => BODY_GOALS.includes(String(a["mainGoal"])) },
    { key: "heightCm", label: "Height (optional)", type: "number", unit: "cm", optional: true, why: "Useful context for your goal; skip if you prefer.", showIf: (a) => BODY_GOALS.includes(String(a["mainGoal"])) },
    { key: "weightKg", label: "Weight (optional)", type: "number", unit: "kg", optional: true, showIf: (a) => BODY_GOALS.includes(String(a["mainGoal"])) },
    { key: "activityLevel", label: "How active are you right now?", type: "single", options: ["Mostly sitting", "Lightly active", "Moderately active", "Very active"] },
    { key: "exerciseTypes", label: "Which kinds of exercise do you enjoy?", type: "multi", options: ["Walking", "Running", "Strength training", "Yoga / stretching", "Sports", "Swimming", "Home workouts"] },
    { key: "trainingDays", label: "Which days can you train?", type: "multi", options: DAYS },
    { key: "exerciseTimes", label: "When do you prefer to exercise?", type: "multi", options: TIMES },
    { key: "sleepHours", label: "Average sleep per night (optional)", type: "number", unit: "hours", optional: true },
    { key: "sleepGoal", label: "Sleep or general wellness goal (optional)", type: "single", optional: true, options: ["Fall asleep earlier", "Sleep more hours", "Wake up rested", "Drink more water", "Eat more regularly"] },
  ],
  development: [
    { key: "mainGoal", label: "What is your main personal-development goal?", type: "single", options: ["Be more consistent", "Stop procrastinating", "Improve focus", "Reduce phone use", "Manage stress better", "Build self-discipline"] },
    { key: "habitsToBuild", label: "Which new habits would you like to build?", type: "multi", custom: true, why: "These are saved as ideas only — no habit is created until you confirm it with Larry.", options: ["Daily planning", "Reading", "Journaling", "Meditation", "Morning routine", "Phone-free time"] },
    { key: "habitsToChange", label: "Which existing habits do you want to change? (optional)", type: "multi", optional: true, custom: true, options: ["Scrolling social media", "Staying up late", "Skipping breaks", "Multitasking", "Snacking while working"] },
    { key: "difficulties", label: "What usually gets in the way?", type: "multi", options: ["Procrastination", "Losing motivation", "Distractions", "Too many goals at once", "Irregular schedule"] },
    { key: "focusLevel", label: "How would you rate your focus? (optional)", type: "scale", optional: true },
    { key: "stressLevel", label: "How would you rate your stress? (optional)", type: "scale", optional: true, why: "Self-reported only — not a clinical assessment." },
    { key: "sleepQuality", label: "How is your sleep quality? (optional)", type: "single", optional: true, options: ["Good", "Okay", "Poor"] },
    { key: "reflectionTimes", label: "When would you like reflection sessions?", type: "multi", options: TIMES },
  ],
};

