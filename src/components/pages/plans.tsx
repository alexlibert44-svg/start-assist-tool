import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, ClipboardList, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlans, PLANS_KEY } from "@/hooks/use-plans";
import { useUpdateHabit } from "@/hooks/use-habits";
import { queryClient } from "@/lib/queryClient";
import { addDays, dayName, type Plan } from "@/shared/plans";
import { PlanEditorDialog } from "@/components/plan-review";

export type { Plan } from "@/shared/plans";

const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function PlansPage() {
  const { data: plans, isLoading, error } = usePlans();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-white/40 text-sm">Loading plans...</div>;
  if (error) return <div className="p-8 text-red-400 text-sm">Could not load your plans.</div>;

  const all = plans ?? [];
  const active = all.filter((p) => p.status === "active" && (!p.startDate || p.startDate <= localToday()));
  const upcoming = all.filter((p) => p.status === "active" && !!p.startDate && p.startDate > localToday());
  const previous = all.filter((p) => p.status === "archived");
  const draft = all.find((p) => p.status === "draft");
  const detail = all.find((p) => p.id === (selected ?? active[0]?.id ?? upcoming[0]?.id ?? previous[0]?.id));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">My Plans</h1>
        {draft && (
          <button onClick={() => draft.conversationId && navigate({ to: "/chat/$conversationId", params: { conversationId: draft.conversationId } })}
            className="glass-panel w-full text-left p-4 border border-purple-500/30 hover:bg-white/10">
            <div className="text-white font-medium">A proposed week is waiting for your approval</div>
            <div className="text-white/50 text-xs">Open Larry's planning chat to review and approve it.</div>
          </button>
        )}
        {active.length === 0 && upcoming.length === 0 && previous.length === 0 ? (
          !draft && (
            <div className="glass-panel p-8 text-center space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-purple-300/70" />
              <p className="text-white font-medium">You don't have a plan yet.</p>
              <p className="text-white/50 text-sm">Use "Build My First Week" in Larry's chat to plan your week. Approved plans appear here.</p>
            </div>
          )
        ) : (
          <>
            <Section title="Active plan" plans={active} empty="No active plan." onSelect={setSelected} today={localToday()} />
            <Section title="Upcoming plans" plans={upcoming} empty="No upcoming plans." onSelect={setSelected} today={localToday()} />
            <Section title="Previous plans" plans={previous} empty="No previous plans." onSelect={setSelected} today={localToday()} />
          </>
        )}
        {detail && detail.status !== "draft" && <PlanDetail plan={detail} />}
      </div>
    </div>
  );
}

function PlanDetail({ plan }: { plan: Plan }) {
  const update = useUpdateHabit();
  const today = localToday();
  const [err, setErr] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const dates = plan.startDate ? Array.from({ length: 7 }, (_, i) => addDays(plan.startDate ?? "", i)) : [];
  const initialDate = dates.includes(today) ? today : dates[0] ?? "";
  const [selectedDate, setSelectedDate] = useState(initialDate);
  useEffect(() => { setSelectedDate(initialDate); }, [plan.id, plan.version, initialDate]);
  const activities = plan.schedule.filter((item) => item.date === selectedDate);
  const completeCount = plan.schedule.filter((item) => item.completed).length;
  const toggle = (habitId: number, completed: boolean) => {
    setErr(null);
    update.mutate({ id: habitId, completed } as never, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
      onError: () => setErr("Could not update this activity. Please try again."),
    });
  };
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">{plan.name}</h2>
            <p className="text-xs uppercase text-muted-foreground">{plan.startDate && plan.startDate > today ? "Upcoming" : plan.status}</p>
          </div>
          {plan.status === "active" && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Edit schedule</Button>}
        </div>
        {plan.description && <p className="mt-1 text-sm text-foreground/80">{plan.description}</p>}
        <p className="text-sm text-muted-foreground">{plan.startDate ?? "—"} to {plan.endDate ?? "—"} · {plan.schedule.length} activities · {completeCount}/{plan.schedule.length} complete</p>
        {plan.schedule.length > 0 && <p className="text-xs text-muted-foreground">{[...new Set(plan.schedule.map((item) => item.category))].join(" · ")}</p>}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Plan days">
        {dates.map((date) => <Button key={date} size="sm" variant={date === selectedDate ? "secondary" : "ghost"} aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)}>
          {date === today ? "Today" : dayName(date).slice(0, 3)} · {date.slice(8)}
        </Button>)}
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {!activities.length && <p className="py-5 text-sm text-muted-foreground">Nothing scheduled for this day.</p>}
      <div className="divide-y divide-border/50">
        {activities.map((item) => {
          const canToggle = plan.status === "active" && item.habitId !== null && (item.category !== "habit" || selectedDate === today);
          return (
            <div key={item.id} className="flex items-center gap-3 py-3">
              {canToggle && item.habitId !== null ? (
                <Button variant="ghost" size="icon" aria-label={`${item.completed ? "Undo" : "Complete"} ${item.title}`} disabled={update.isPending} onClick={() => toggle(item.habitId as number, !item.completed)}>
                  {item.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                </Button>
              ) : item.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500/70" /> : <Circle className="h-5 w-5 text-muted-foreground/50" />}
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.start}–{item.end} · {item.durationMinutes} min · {item.category} · {item.character}</div>
              </div>
              <span className="text-xs text-muted-foreground">{item.completed ? "Completed" : "Scheduled"}</span>
            </div>
          );
        })}
      </div>
      {plan.status === "active" && <PlanEditorDialog plan={plan} open={editOpen} onOpenChange={setEditOpen} onDone={() => {
        void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
        void queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      }} />}
    </div>
  );
}

function Section({ title, plans, empty, onSelect, today }: { title: string; plans: Plan[]; empty: string; onSelect: (id: string) => void; today: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-white/40 text-xs uppercase tracking-wider">{title}</h2>
      {plans.length === 0 ? (
        <p className="text-white/40 text-sm">{empty}</p>
      ) : (
        plans.map((p) => (
          <Button key={p.id} variant="ghost" onClick={() => onSelect(p.id)} className="h-auto w-full flex-col items-start gap-1 border-b border-border px-1 py-3 text-left">
            <span className="flex w-full justify-between gap-2"><span className="font-medium text-foreground">{p.name}</span><span className="text-xs uppercase text-muted-foreground">{p.startDate && p.startDate > today ? "Upcoming" : p.status}</span></span>
            <span className="text-xs text-muted-foreground">{p.startDate ?? "—"} to {p.endDate ?? "—"} · {p.schedule.length} activities · {p.schedule.filter((item) => item.completed).length} complete</span>
            <span className="text-xs text-muted-foreground">{[...new Set(p.schedule.map((item) => item.category))].join(" · ") || "No categories"}</span>
          </Button>
        ))
      )}
    </div>
  );
}
