import { supabase } from "@/integrations/supabase/client";

export const GOALS = ["Reduce phone time", "Build better habits", "Learn new skills", "Improve fitness & health", "Stay focused at work or study"];
export const CHALLENGES = ["Procrastination", "Social media / phone distraction", "Lack of motivation", "Poor sleep or low energy", "No clear plan"];
export const PHONE_USAGE = ["Less than 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"];
export const SITUATIONS = ["Student", "Working", "Studying independently", "Working and studying", "Other"];

export type OnboardingProfile = {
  preferredName?: string | null; primaryGoal?: string | null; biggestChallenge?: string | null;
  phoneUsage?: string | null; currentSituation?: string | null; onboardingStep?: number | null;
  onboardingCompleted?: boolean | null;
};

/** Where a visitor should go next, based on their session and saved onboarding progress. */
export async function nextOnboardingPath(): Promise<"/welcome" | "/onboarding" | "/team-setup" | "app"> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return "/welcome";
  const res = await fetch("/api/profile");
  if (!res.ok) return "/onboarding";
  const p = (await res.json()) as OnboardingProfile;
  if (!(p.onboardingCompleted && (p.onboardingStep ?? 0) >= 7)) return "/onboarding";
  const t = await fetch("/api/team-setup");
  if (!t.ok) return "app";
  return ((await t.json()) as { completedAt: string | null }).completedAt ? "app" : "/team-setup";
}
