import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ClipboardList, Loader2, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamSetup } from "@/hooks/use-team-setup";
import { usePlans, startPlanning } from "@/hooks/use-plans";
import { useHabits, useStats } from "@/hooks/use-habits";
import { useCharacter } from "@/store/use-character";
import { queryClient } from "@/lib/queryClient";
import { CONVERSATIONS_KEY } from "@/hooks/use-conversations";
import { KIND_LABEL } from "@/shared/team-setup";

export const PLANNING_KICKOFF = "Let's build my first week.";

// Larry's Command Center: shown once all three specialist profiles are saved, until planning has started.
export function CommandCenter({ planningStarted }: { planningStarted: boolean }) {
  const navigate = useNavigate();
  const handoff = useCharacter((s) => s.handoff);
  const { data } = useTeamSetup();
  const plans = usePlans();
  const habits = useHabits();
  const stats = useStats();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const today = stats.data?.today ?? new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const allHabits = habits.data ?? [];
  const dueToday = allHabits.filter((habit) => habit.kind !== "task" || (habit.dueAt && new Date(new Date(habit.dueAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) === today));
  const pendingTasks = allHabits.filter((habit) => habit.kind === "task" && !habit.completed);
  const activePlan = plans.data?.find((plan) => plan.status === "active");
  const nextActivities = activePlan?.schedule.filter((item) => item.date >= today && !item.completed).slice(0, 3) ?? [];
  const hasError = !!data && (!!plans.error || !!habits.error || !!stats.error);

  const start = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await startPlanning();
      if (!r.resumed) handoff("Larry", "Larry", PLANNING_KICKOFF, r.conversationId);
      await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      await navigate({ to: "/chat/$conversationId", params: { conversationId: r.conversationId } });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <section className="glass-panel mt-4 shrink-0 space-y-4 border border-primary/25 p-4 sm:p-5" aria-label="Larry command center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-primary">Command Center</div>
          <p className="mt-1 text-sm text-foreground">Your saved activity and progress, for {today}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/habits"><Target className="mr-2 h-4 w-4" /> Habits</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/plans"><ClipboardList className="mr-2 h-4 w-4" /> Plans</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/progress"><TrendingUp className="mr-2 h-4 w-4" /> Progress</Link></Button>
        </div>
      </div>
      {hasError && <p role="status" className="text-sm text-destructive">Some saved progress could not be loaded. Refresh to try again.</p>}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-border/60 py-3 sm:grid-cols-4">
        <Metric label="Points" value={stats.data ? `${stats.data.points}` : "—"} />
        <Metric label="Today" value={stats.data ? `${stats.data.completedToday}/${stats.data.dueToday}` : "—"} />
        <Metric label="Consecutive days" value={stats.data ? `${stats.data.consecutiveDays}` : "—"} />
        <Metric label="Completion" value={stats.data?.dailyCompletionRate === null ? "None scheduled" : stats.data ? `${stats.data.dailyCompletionRate}%` : "—"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Today's schedule</h3>
          {dueToday.length ? <ul className="mt-2 space-y-1">{dueToday.slice(0, 4).map((habit) => <li key={habit.id} className="flex items-center gap-2 text-sm text-foreground">
            <Check className={`h-4 w-4 shrink-0 ${habit.completed ? "text-emerald-500" : "text-muted-foreground/50"}`} />
            <span className={habit.completed ? "text-muted-foreground line-through" : ""}>{habit.name}</span>
          </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No activities scheduled today.</p>}
          {pendingTasks.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{pendingTasks.length} open task{pendingTasks.length === 1 ? "" : "s"} across your tracker.</p>}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Active plan</h3>
          {activePlan ? <>
            <p className="mt-2 text-sm font-medium text-foreground">{activePlan.name}</p>
            <p className="text-xs text-muted-foreground">{activePlan.startDate} – {activePlan.endDate} · {activePlan.schedule.filter((item) => item.completed).length}/{activePlan.schedule.length} complete</p>
            {nextActivities.length > 0 && <ul className="mt-2 space-y-1">{nextActivities.map((item) => <li key={item.id} className="text-xs text-muted-foreground">{item.date} · {item.start} · {item.title} ({item.character})</li>)}</ul>}
          </> : <p className="mt-2 text-sm text-muted-foreground">No approved plan yet.</p>}
        </div>
      </div>
      {!data?.completedAt ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-sm text-muted-foreground">Complete each saved specialist profile to unlock lifestyle planning.</span>
        <Button asChild size="sm" variant="outline"><Link to="/team-setup">Team Setup</Link></Button>
      </div> : !activePlan && !plans.data?.some((plan) => plan.status === "draft") ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-sm text-muted-foreground">{data.stages.map((stage) => KIND_LABEL[stage.kind]).join(" · ")} ready.</span>
        <Button onClick={start} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{error ? "Try again" : planningStarted ? "Resume Lifestyle Planning" : "Build My First Week"}
        </Button>
      </div> : null}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-semibold text-foreground">{value}</p></div>;
}
