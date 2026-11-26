import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePlans, PLANS_KEY, saveDraftItems, approvePlan, rejectPlan } from "@/hooks/use-plans";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/shared/routes";
import { STATS_KEY } from "@/hooks/use-habits";
import { addDays, dayName, PLAN_CATEGORIES, PLAN_CHARACTERS, toMin, type Plan, type PlanItem } from "@/shared/plans";

const field = "bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-white/30";

/** Review/edit/approve Larry's draft proposal. Nothing is approved until the user presses Approve. */
export function PlanReview({ conversationId, openSignal }: { conversationId: string; openSignal: number }) {
  const { data } = usePlans();
  const proposal = data?.find((p) => p.status === "draft" && (!p.conversationId || p.conversationId === conversationId));
  const approved = data?.find((p) => p.status === "active" && p.conversationId === conversationId);
  const plan = proposal ?? approved;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);
  if (!plan) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="mt-3 h-auto w-full justify-between gap-3 border-primary/30 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" /> {plan.status === "active" ? "Open approved week" : "Review proposed week"}</span>
        <span className="text-xs text-muted-foreground">{plan.schedule.length} activities · {plan.status === "active" ? "saved plan" : "awaiting review"}</span>
      </Button>
      <PlanEditorDialog plan={plan} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function PlanEditorDialog({ plan, open, onOpenChange, onDone }: {
  plan: Plan; open: boolean; onOpenChange: (open: boolean) => void; onDone?: (approved: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background text-foreground">
        <Editor key={`${plan.id}-${plan.version}`} plan={plan} onDone={(approved) => { onOpenChange(false); onDone?.(approved); }} />
      </DialogContent>
    </Dialog>
  );
}

function Editor({ plan, onDone }: { plan: Plan; onDone: (approved: boolean) => void }) {
  const [items, setItems] = useState<PlanItem[]>(plan.schedule);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const isDraft = plan.status === "draft";
  const start = plan.startDate;
  const dates = start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [];

  const patch = (id: string, u: Partial<PlanItem>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...u } : x)));
    setDirty(true); setSavedMsg(null);
  };
  const remove = (id: string) => { setItems((xs) => xs.filter((x) => x.id !== id)); setDirty(true); setSavedMsg(null); };
  const add = (date: string) => {
    setItems((xs) => [...xs, { id: crypto.randomUUID(), title: "New activity", description: "", date, day: dayName(date), start: "18:00", end: "18:30", durationMinutes: 30, category: "other", character: "Larry", habitId: null, completed: false, planVersion: plan.version + 1 }]);
    setDirty(true); setSavedMsg(null);
  };

  const save = async () => {
    const p = await saveDraftItems(plan.id, items);
    setItems(p.schedule);
    await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    await queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    await queryClient.invalidateQueries({ queryKey: STATS_KEY });
    setDirty(false);
    return p;
  };
  const run = async (kind: "save" | "approve" | "reject") => {
    if (busy) return;
    setBusy(kind); setError(null);
    try {
      if (kind === "reject") { await rejectPlan(plan.id); onDone(false); return; }
      if (dirty) await save();
      if (kind === "save") { setSavedMsg("Changes saved."); return; }
      await approvePlan(plan.id);
      onDone(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">{plan.name}</DialogTitle>
        <DialogDescription className="text-white/60">
          {isDraft ? `Proposal v${plan.version} · ` : `Saved plan v${plan.version} · `}{start ?? "Dates unavailable"} to {plan.endDate ?? "—"}. {isDraft ? "Review and edit the proposal before approval." : "Edit this saved schedule; linked tasks stay synchronized."}
        </DialogDescription>
      </DialogHeader>
      {dates.map((d) => {
        const list = items.filter((x) => x.date === d).sort((a, b) => toMin(a.start) - toMin(b.start));
        return (
          <div key={d} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-purple-300 font-semibold">{dayName(d)} · {d}</h3>
              <button onClick={() => add(d)} className="text-xs text-white/60 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
            </div>
            {list.length === 0 && <p className="text-white/30 text-sm">Nothing scheduled.</p>}
            {list.map((it) => (
              <div key={it.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex gap-2">
                  <input aria-label="Title" className={`${field} flex-1`} value={it.title} onChange={(e) => patch(it.id, { title: e.target.value })} />
                  <button aria-label={`Remove ${it.title}`} onClick={() => remove(it.id)} className="text-white/40 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs text-white/60">
                  <select aria-label="Day" className={field} value={it.date} onChange={(e) => patch(it.id, { date: e.target.value, day: dayName(e.target.value) })}>
                    {dates.map((x) => <option key={x} value={x} className="bg-black">{dayName(x).slice(0, 3)} {x.slice(5)}</option>)}
                  </select>
                  <input aria-label="Start time" type="time" className={field} value={it.start} onChange={(e) => patch(it.id, { start: e.target.value })} />
                  <label className="flex items-center gap-1">
                    <input aria-label="Duration minutes" type="number" min={5} max={600} className={`${field} w-20`} value={it.durationMinutes}
                      onChange={(e) => patch(it.id, { durationMinutes: Number(e.target.value) })} /> min
                  </label>
                  <select aria-label="Category" className={field} value={it.category} onChange={(e) => patch(it.id, { category: e.target.value as PlanItem["category"] })}>
                    {PLAN_CATEGORIES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}
                  </select>
                  <select aria-label="Coach" className={field} value={it.character} onChange={(e) => patch(it.id, { character: e.target.value as PlanItem["character"] })}>
                    {PLAN_CHARACTERS.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}
                  </select>
                  {it.habitId != null && <span className="text-emerald-300">linked habit</span>}
                </div>
                {it.description && <p className="text-white/50 text-xs">{it.description}</p>}
              </div>
            ))}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {savedMsg && <p className="text-sm text-emerald-300">{savedMsg}</p>}
      <div className="flex flex-wrap gap-2 justify-end sticky bottom-0 bg-background pt-3">
        {isDraft && <Button variant="ghost" className="text-muted-foreground" disabled={!!busy} onClick={() => run("reject")}>Reject proposal</Button>}
        <Button variant="outline" disabled={!!busy || !dirty} onClick={() => run("save")}>
          {busy === "save" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save changes
        </Button>
        {isDraft && <Button disabled={!!busy || items.length === 0} onClick={() => run("approve")}>
          {busy === "approve" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Approve and Save Plan
        </Button>}
      </div>
    </div>
  );
}
