import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeamSetup } from "@/hooks/use-team-setup";
import { useHabits, useStats } from "@/hooks/use-habits";
import { usePlans } from "@/hooks/use-plans";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { KIND_CHARACTER } from "@/shared/team-setup";
import type { Profile } from "@/shared/schema";
import type { InsertProfile } from "@/shared/routes";
import { supabase } from "@/integrations/supabase/client";
import { GOALS, CHALLENGES, PHONE_USAGE, SITUATIONS } from "@/lib/onboarding";

type FieldKey = "preferredName" | "primaryGoal" | "biggestChallenge" | "phoneUsage" | "currentSituation";
type Field = { key: FieldKey; label: string; options?: string[] };
const BASIC_FIELDS: Field[] = [
  { key: "preferredName", label: "Preferred name" },
  { key: "currentSituation", label: "Current situation", options: SITUATIONS },
];
const GOAL_FIELDS: Field[] = [
  { key: "primaryGoal", label: "Primary goal", options: GOALS },
  { key: "biggestChallenge", label: "Biggest current challenge", options: CHALLENGES },
  { key: "phoneUsage", label: "Daily phone usage", options: PHONE_USAGE },
];

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const team = useTeamSetup();
  const habits = useHabits();
  const plans = usePlans();
  const stats = useStats();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground text-sm">Loading profile…</div>;
  if (error || !profile) return <div className="p-8 text-destructive text-sm">Could not load your profile.</div>;
  const name = profile.preferredName || profile.name || "Your profile";
  const activePlan = plans.data?.find((plan) => plan.status === "active");

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {settingsOpen ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase text-primary">Personal settings</p><h1 className="mt-1 font-display text-2xl font-bold text-foreground">Settings &amp; Personal Information</h1></div>
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Back to profile</Button>
            </div>
            <div className="glass-panel divide-y divide-border/60 px-4 sm:px-6">
              <details className="py-4"><summary className="cursor-pointer font-semibold text-foreground">Basic Information</summary><div className="pt-4"><ProfileFieldEditor profile={profile} fields={BASIC_FIELDS} /></div></details>
              <details className="py-4"><summary className="cursor-pointer font-semibold text-foreground">Goals and Preferences</summary><div className="pt-4"><ProfileFieldEditor profile={profile} fields={GOAL_FIELDS} /></div></details>
              {team.data?.stages.map((stage) => (
                <details key={stage.kind} className="py-4">
                  <summary className="cursor-pointer font-semibold text-foreground">{stage.kind === "learning" ? "Learning Profile" : stage.kind === "wellness" ? "Fitness and Wellness Profile" : "Behavioral Development Profile"}</summary>
                  <div className="pt-4"><SavedSpecialistProfile stage={stage} /></div>
                </details>
              ))}
              <details className="py-4">
                <summary className="cursor-pointer font-semibold text-foreground">Habits and Personal Development</summary>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4"><p className="text-sm text-muted-foreground">{habits.data?.filter((habit) => habit.kind !== "task").length ?? "—"} saved daily habits</p><Button asChild variant="outline" size="sm"><Link to="/habits">Open Habit Tracker</Link></Button></div>
              </details>
              <details className="py-4">
                <summary className="cursor-pointer font-semibold text-foreground">Schedule and Availability</summary>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4"><p className="text-sm text-muted-foreground">{activePlan ? `${activePlan.name} · ${activePlan.startDate ?? "—"} to ${activePlan.endDate ?? "—"}` : "No approved schedule saved yet."}</p><Button asChild variant="outline" size="sm"><Link to="/plans">Open Plans</Link></Button></div>
              </details>
              <details className="py-4">
                <summary className="cursor-pointer font-semibold text-foreground">Account Settings</summary>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4"><p className="text-sm text-muted-foreground">Onboarding {profile.onboardingCompleted ? "completed" : "in progress"}</p><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></div>
              </details>
            </div>
            {team.error && <p role="status" className="text-sm text-destructive">Specialist profiles could not be loaded.</p>}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-2xl font-bold text-primary" aria-label="Profile avatar">{name.trim().charAt(0).toUpperCase() || "U"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-primary">Your journey</p>
                <h1 className="mt-1 break-words font-display text-3xl font-bold text-foreground">{name}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{profile.primaryGoal ? `Working toward ${profile.primaryGoal}` : "Build a steady path, one saved action at a time."}{profile.biggestChallenge ? ` · Navigating ${profile.biggestChallenge}` : ""}</p>
              </div>
              <Button onClick={() => setSettingsOpen(true)}>Settings &amp; Personal Information</Button>
            </div>
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Progress summary">
              <Summary label="Points" value={stats.data ? `${stats.data.points}` : "—"} />
              <Summary label="Consecutive days" value={stats.data ? `${stats.data.consecutiveDays}` : "—"} />
              <Summary label="Today's rate" value={stats.data?.dailyCompletionRate === null ? "No activities" : stats.data ? `${stats.data.dailyCompletionRate}%` : "—"} />
              <Summary label="Daily habits" value={habits.data ? `${habits.data.filter((habit) => habit.kind !== "task").length}` : "—"} />
            </section>
            <p className="text-xs text-muted-foreground">Your answers and specialist profiles are saved to your account. Profile photo upload is not configured, so your avatar uses your initials.</p>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileFieldEditor({ profile, fields }: { profile: Profile; fields: Field[] }) {
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const start = () => { setDraft(Object.fromEntries(fields.map((field) => [field.key, (profile[field.key] as string | null) ?? ""]))); setError(null); setEditing(true); };
  const save = async () => {
    const preferredName = draft["preferredName"]?.trim();
    if (fields.some((field) => field.key === "preferredName") && !preferredName) { setError("Preferred name is required."); return; }
    const patch: Record<string, string> = {};
    for (const field of fields) patch[field.key] = (draft[field.key] ?? "").trim();
    if (preferredName) patch["name"] = preferredName;
    try { await update.mutateAsync(patch as Partial<InsertProfile>); setEditing(false); }
    catch { setError("Could not save your changes. Your saved information is unchanged."); }
  };
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const saved = (profile[field.key] as string | null) ?? "";
        const options = field.options ?? [];
        const customValue = !!saved && options.length > 0 && !options.includes(saved);
        return <div key={field.key} className="grid gap-1 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">
          <span className="text-sm text-muted-foreground">{field.label}</span>
          {editing ? field.options && !customValue ? <select aria-label={field.label} value={draft[field.key] ?? ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} className="glass-input rounded-md px-3 py-2 text-foreground">
            <option value="">Not set</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select> : <Input aria-label={field.label} maxLength={field.key === "preferredName" ? 40 : 80} value={draft[field.key] ?? ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
            : <span className="break-words text-sm text-foreground">{saved || <span className="text-muted-foreground">Not set</span>}</span>}
        </div>;
      })}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {editing ? <><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void save()} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></>
          : <Button variant="outline" size="sm" onClick={start}>Edit</Button>}
      </div>
    </div>
  );
}

function SavedSpecialistProfile({ stage }: { stage: { kind: "learning" | "wellness" | "development"; answers: Record<string, unknown>; completedAt: string | null } }) {
  const character = KIND_CHARACTER[stage.kind];
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{stage.completedAt ? `${character}'s saved answers` : "This profile has not been completed yet."}</p>
    {stage.completedAt && <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(stage.answers).map(([key, value]) => <div key={key} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt>
      <dd className="break-words text-sm text-foreground">{formatValue(value)}</dd>
    </div>)}</dl>}
    <Button asChild variant="outline" size="sm"><Link to="/team-setup" search={stage.completedAt ? { edit: stage.kind } : {}}>{stage.completedAt ? "Review and edit" : "Continue setup"}</Link></Button>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-border pt-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold text-foreground">{value}</p></div>;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "Not set");
}
