import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const { data } = usePlans();
  const draft = data?.find((p) => p.status === "draft" && (!p.conversationId || p.conversationId === conversationId));
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);
  if (!draft) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="glass-panel mt-3 w-full shrink-0 flex items-center justify-between gap-3 px-4 py-3 border border-purple-500/30 text-left hover:bg-white/10 transition-colors">
        <span className="flex items-center gap-2 text-white text-sm font-medium"><CalendarDays className="w-4 h-4 text-purple-300" /> Review proposed week</span>
        <span className="text-white/50 text-xs">{draft.schedule.length} activities · not approved yet</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0b0b14] border-white/10 text-white">
          <Editor key={`${draft.id}-${draft.version}`} draft={draft} onDone={async (approved) => {
            setOpen(false);
            await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
            if (approved) {
              void queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
              void queryClient.invalidateQueries({ queryKey: STATS_KEY });
              void navigate({ to: "/plans" });
            }
          }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Editor({ draft, onDone }: { draft: Plan; onDone: (approved: boolean) => void }) {
  const [items, setItems] = useState<PlanItem[]>(draft.schedule);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const start = draft.startDate!;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const patch = (id: string, u: Partial<PlanItem>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...u } : x)));
    setDirty(true); setSavedMsg(null);
  };
  const remove = (id: string) => { setItems((xs) => xs.filter((x) => x.id !== id)); setDirty(true); setSavedMsg(null); };
  const add = (date: string) => {
    setItems((xs) => [...xs, { id: crypto.randomUUID(), title: "New activity", description: "", date, day: dayName(date), start: "18:00", end: "18:30", durationMinutes: 30, category: "other", character: "Larry", habitId: null, completed: false, planVersion: draft.version }]);
    setDirty(true); setSavedMsg(null);
  };

  const save = async () => {
    const p = await saveDraftItems(draft.id, items);
    await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    setDirty(false);
    return p;
  };
  const run = async (kind: "save" | "approve" | "reject") => {
    if (busy) return;
    setBusy(kind); setError(null);
    try {
      if (kind === "reject") { await rejectPlan(draft.id); onDone(false); return; }
      if (dirty) await save();
      if (kind === "save") { setSavedMsg("Changes saved."); return; }
      await approvePlan(draft.id);
      onDone(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">{draft.name}</DialogTitle>
        <DialogDescription className="text-white/60">
          Proposal v{draft.version} · {start} to {draft.endDate}. Edit anything below, then approve. Ask Larry in the chat if you want him to rework it.
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
      <div className="flex flex-wrap gap-2 justify-end sticky bottom-0 bg-[#0b0b14] pt-3">
        <Button variant="ghost" className="text-white/60 hover:bg-white/10" disabled={!!busy} onClick={() => run("reject")}>Reject proposal</Button>
        <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" disabled={!!busy || !dirty} onClick={() => run("save")}>
          {busy === "save" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save changes
        </Button>
        <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white" disabled={!!busy || items.length === 0} onClick={() => run("approve")}>
          {busy === "approve" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Approve and Save Plan
        </Button>
      </div>
    </div>
  );
}
