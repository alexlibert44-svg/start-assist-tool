import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { usePlans, PLANS_KEY } from "@/hooks/use-plans";
import { useUpdateHabit } from "@/hooks/use-habits";
import { queryClient } from "@/lib/queryClient";
import { addDays, dayName, type Plan } from "@/shared/plans";

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
  const active = all.filter((p) => p.status === "active");
  const previous = all.filter((p) => p.status === "archived");
  const draft = all.find((p) => p.status === "draft");
  const detail = all.find((p) => p.id === (selected ?? active[0]?.id));

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
        {active.length === 0 && previous.length === 0 ? (
          !draft && (
            <div className="glass-panel p-8 text-center space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-purple-300/70" />
              <p className="text-white font-medium">You don't have a plan yet.</p>
              <p className="text-white/50 text-sm">Use "Build My First Week" in Larry's chat to plan your week. Approved plans appear here.</p>
            </div>
          )
        ) : (
          <>
            <Section title="Active plan" plans={active} empty="No active plan." onSelect={setSelected} />
            <Section title="Previous plans" plans={previous} empty="No previous plans." onSelect={setSelected} />
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
  const dates = plan.startDate ? Array.from({ length: 7 }, (_, i) => addDays(plan.startDate!, i)) : [];
  const toggle = (habitId: number, completed: boolean) => {
    setErr(null);
    update.mutate({ id: habitId, completed } as never, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
      onError: () => setErr("Could not update this activity. Please try again."),
    });
  };
  return (
    <div className="glass-panel p-5 space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-white">{plan.name}</h2>
        <p className="text-white/50 text-xs uppercase tracking-wider">{plan.status}</p>
        {plan.description && <p className="text-white/80 mt-1">{plan.description}</p>}
        <p className="text-white/60 text-sm">
          {plan.startDate} to {plan.endDate} · created {new Date(plan.createdAt).toLocaleDateString()}
          {plan.approvedAt ? ` · approved ${new Date(plan.approvedAt).toLocaleDateString()}` : ""}
        </p>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {dates.map((d) => {
        const list = plan.schedule.filter((x) => x.date === d);
        return (
          <div key={d} className="space-y-1.5">
            <h3 className={`text-xs uppercase tracking-wider font-semibold ${d === today ? "text-purple-300" : "text-white/40"}`}>
              {dayName(d)} · {d}{d === today ? " · today" : ""}
            </h3>
            {list.length === 0 && <p className="text-white/30 text-sm">Nothing scheduled.</p>}
            {list.map((it) => {
              // Tasks can be ticked any time; a daily habit only for today (its completion is per local day).
              const canToggle = plan.status === "active" && it.habitId != null && (it.category !== "habit" || d === today);
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                  {canToggle ? (
                    <button aria-label={`${it.completed ? "Undo" : "Complete"} ${it.title}`} disabled={update.isPending} onClick={() => toggle(it.habitId!, !it.completed)}>
                      {it.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-white/40" />}
                    </button>
                  ) : it.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400/60" /> : <Circle className="w-5 h-5 text-white/15" />}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${it.completed ? "text-white/50 line-through" : "text-white"}`}>{it.title}</div>
                    <div className="text-white/40 text-xs">{it.start}–{it.end} · {it.category} · {it.character}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, plans, empty, onSelect }: { title: string; plans: Plan[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <h2 className="text-white/40 text-xs uppercase tracking-wider">{title}</h2>
      {plans.length === 0 ? (
        <p className="text-white/40 text-sm">{empty}</p>
      ) : (
        plans.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className="glass-panel w-full text-left p-4 hover:bg-white/10 transition-colors">
            <div className="text-white font-medium">{p.name}</div>
            <div className="text-white/50 text-xs">{p.startDate} to {p.endDate} · created {new Date(p.createdAt).toLocaleDateString()}</div>
          </button>
        ))
      )}
    </div>
  );
}
