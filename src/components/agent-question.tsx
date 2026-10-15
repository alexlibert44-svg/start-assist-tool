import { useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { answerValid, questionSchema, workflowStateSchema, type AgentQuestion, type Workflow } from "@/shared/agent-questions";

export function AgentAnswer({ question: q, value, onChange }: { question: AgentQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const [custom, setCustom] = useState("");
  const arr = Array.isArray(value) ? value : [];
  const options = [...q.options, ...arr.filter((v): v is string => typeof v === "string" && !q.options.includes(v)), ...(typeof value === "string" && value && !q.options.includes(value) && q.type === "single" ? [value] : [])];
  const choice = (selected: boolean) => `agent-choice h-auto min-h-11 whitespace-normal justify-start text-left px-4 py-3 ${selected ? "agent-choice-selected" : ""}`;
  return <fieldset className="space-y-3 min-w-0">
    <legend className="font-display text-lg sm:text-xl text-foreground mb-3">{q.label}</legend>
    {(q.type === "single" || q.type === "multi") && <>
      <div role={q.type === "single" ? "radiogroup" : "group"} aria-label={q.label} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((o) => { const selected = q.type === "multi" ? arr.includes(o) : value === o; return <Button key={o} variant="outline" type="button" role={q.type === "single" ? "radio" : "checkbox"} aria-checked={selected} className={choice(selected)} onClick={() => onChange(q.type === "multi" ? selected ? arr.filter((v) => v !== o) : [...arr, o] : selected && q.optional ? undefined : o)}><span className="flex-1 break-words">{o}</span>{selected && <Check className="shrink-0" />}</Button>; })}
      </div>
      <div className="flex gap-2"><Input aria-label="Your own answer" value={custom} maxLength={80} onChange={(e) => setCustom(e.target.value)} placeholder="Your own answer" className="bg-background/50 text-foreground" /><Button variant="ghost" size="icon" aria-label="Add your answer" disabled={!custom.trim()} onClick={() => { onChange(q.type === "multi" ? [...new Set([...arr, custom.trim()])] : custom.trim()); setCustom(""); }}><Plus /></Button></div>
    </>}
    {(q.type === "text" || q.type === "number") && <Input aria-label={q.label} type={q.type === "number" ? "number" : "text"} value={value === undefined ? "" : String(value)} maxLength={1000} className="bg-background/50 text-foreground" onChange={(e) => onChange(q.type === "number" ? e.target.value === "" ? undefined : Number(e.target.value) : e.target.value)} />}
    {q.type === "scale" && <div role="radiogroup" aria-label={q.label} className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <Button key={n} variant="outline" role="radio" aria-checked={value === n} className={choice(value === n)} onClick={() => onChange(value === n ? undefined : n)}>{n}</Button>)}</div>}
    {q.type === "subjects" && <div className="space-y-3">{arr.map((s: { name: string; level: string }, i) => <div key={s.name} className="flex flex-wrap gap-2 items-center"><span className="flex-1 text-foreground">{s.name}</span><select aria-label={`${s.name} level`} value={s.level} className="bg-background text-foreground border border-border rounded-md p-2" onChange={(e) => onChange(arr.map((v, j) => j === i ? { ...v, level: e.target.value } : v))}>{["Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}</select><Button size="icon" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => onChange(arr.filter((_, j) => j !== i))}><X /></Button></div>)}<div className="flex gap-2"><Input aria-label="Subject or skill" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} placeholder="Subject or skill" /><Button variant="ghost" aria-label="Add subject" disabled={!custom.trim() || arr.length >= 8} onClick={() => { if (!arr.some((s) => s.name === custom.trim())) onChange([...arr, { name: custom.trim(), level: "Beginner" }]); setCustom(""); }}><Plus />Add</Button></div></div>}
  </fieldset>;
}

export function AgentQuestionStep({ workflow, fieldKey, answers, value, onChange, onReady }: { workflow: Workflow; fieldKey: string; answers: Record<string, unknown>; value: unknown; onChange: (value: unknown) => void; onReady?: (question: AgentQuestion | null) => void }) {
  const [question, setQuestion] = useState<AgentQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [terminal, setTerminal] = useState(false);
  useEffect(() => {
    let live = true;
    setQuestion(null); setError(null); onReady?.(null);
    fetch("/api/agent-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow, key: fieldKey, answers, resume: retry > 0 }) }).then(async (res) => {
      const body = await res.json(); if (!res.ok) { if (live) setTerminal(res.status === 403 || res.status === 404); throw new Error(body.message ?? "Could not prepare the question."); }
      const q = questionSchema.parse(body); if (q.key !== fieldKey) throw new Error("The question did not match this step.");
      if (live) { setQuestion(q); onReady?.(q); }
    }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not prepare the question."); });
    return () => { live = false; };
    // Answers are context at entry; changing a selection must not regenerate its question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, fieldKey, retry]);
  if (error) return <div className="space-y-3"><p role="alert" className="text-foreground">{error}</p>{!terminal && <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>Try again</Button>}</div>;
  if (!question) return <div role="status" className="flex items-center gap-3 py-8 text-muted-foreground"><Loader2 className="animate-spin" />Preparing your question...</div>;
  return <AgentAnswer question={question} value={value} onChange={onChange} />;
}

export async function saveQuestionProgress(workflow: Workflow, answers: Record<string, unknown>, step: number) {
  const res = await fetch(`/api/agent-questions?workflow=${workflow}`);
  if (!res.ok) throw new Error("Could not load your question progress.");
  const parsed = workflowStateSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("Could not restore your questions.");
  const saved = await fetch("/api/agent-questions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow, state: { ...parsed.data, answers, step } }) });
  if (!saved.ok) throw new Error("Could not save your progress. Please try again.");
}
export { answerValid };