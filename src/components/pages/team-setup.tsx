import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHARACTERS } from "@/store/use-character";
import { useTeamSetup, saveSetupStage, TEAM_SETUP_KEY } from "@/hooks/use-team-setup";
import { createConversationRequest, fetchConversations } from "@/hooks/use-conversations";
import {
  BODY_GOALS, KIND_CHARACTER, KIND_DONE_MESSAGE, KIND_LABEL, LEVELS, SETUP_KINDS, SETUP_SCHEMAS, type SetupKind, type TeamSetupState,
} from "@/shared/team-setup";

type A = Record<string, unknown>;
type Field = {
  key: string; label: string; type: "single" | "multi" | "number" | "text" | "scale" | "subjects";
  options?: string[]; optional?: boolean; why?: string; unit?: string; custom?: boolean; showIf?: (a: A) => boolean;
};

const TIMES = ["Early morning", "Morning", "Afternoon", "Evening", "Late night"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FIELDS: Record<SetupKind, Field[]> = {
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

export default function TeamSetupPage({ edit }: { edit?: SetupKind }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useTeamSetup();
  const [stage, setStage] = useState<SetupKind | null>(null);
  const [justDone, setJustDone] = useState<SetupKind | null>(null);

  useEffect(() => {
    if (!data || stage) return;
    setStage(edit ?? data.currentStage ?? "development");
    if (!edit && !data.currentStage) setJustDone("development");
  }, [data, stage, edit]);

  if (isLoading || (!error && !stage)) return <div className="flex-1 flex items-center justify-center text-white/40 text-sm">Loading Team Setup...</div>;
  if (error || !data || !stage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-red-300">
        <p>Could not load Team Setup.</p>
        <Button variant="ghost" className="text-white/70" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const st = data.stages.find((s) => s.kind === stage)!;
  const idx = SETUP_KINDS.indexOf(stage);
  const goLarry = async () => {
    const list = await fetchConversations("Larry");
    const conv = list[0] ?? (await createConversationRequest("Larry"));
    navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id }, replace: true });
  };
  const goTo = (k: SetupKind) => { setJustDone(null); setStage(k); };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <Stepper state={data} current={stage} onPick={(k) => { const s = data.stages.find((x) => x.kind === k)!; if (s.completedAt || k === data.currentStage) goTo(k); }} />
        {justDone === stage ? (
          <div className="glass-panel p-6 text-center space-y-4">
            <Check className="w-10 h-10 mx-auto text-emerald-400" />
            <p className="text-white text-lg font-semibold">{KIND_DONE_MESSAGE[stage]}</p>
            <p className="text-white/60 text-sm">Larry now has your saved {KIND_LABEL[stage].toLowerCase()}.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="ghost" className="text-white/70" onClick={() => setJustDone(null)}>Review answers</Button>
              {data.currentStage ? (
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white" onClick={() => goTo(data.currentStage!)}>
                  Continue to {KIND_CHARACTER[data.currentStage]}
                </Button>
              ) : (
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white" onClick={() => void goLarry()}>
                  Return to Larry
                </Button>
              )}
            </div>
          </div>
        ) : (
          <StageForm
            key={stage}
            kind={stage}
            initial={st.answers}
            completed={!!st.completedAt}
            onBack={idx > 0 ? () => goTo(SETUP_KINDS[idx - 1]!) : undefined}
            onSaved={(next) => { qc.setQueryData(TEAM_SETUP_KEY, next); setJustDone(stage); }}
            onDraft={(next) => qc.setQueryData(TEAM_SETUP_KEY, next)}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ state, current, onPick }: { state: TeamSetupState; current: SetupKind; onPick: (k: SetupKind) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4" aria-label="Team Setup progress">
      {state.stages.map((s) => {
        const c = CHARACTERS[KIND_CHARACTER[s.kind]];
        const active = s.kind === current;
        return (
          <button key={s.kind} onClick={() => onPick(s.kind)} aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? `${c.theme.border} bg-white/10 text-white` : "border-white/10 text-white/55"}`}>
            {s.completedAt ? <Check className="w-4 h-4 text-emerald-400" /> : <Circle className={`w-4 h-4 ${active ? c.theme.text : ""}`} />}
            <img src={c.image} alt="" className="w-6 h-6 rounded-full object-cover hidden sm:block" />
            <span className={active ? `font-semibold ${c.theme.text}` : ""}>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function StageForm({ kind, initial, completed, onBack, onSaved, onDraft }: {
  kind: SetupKind; initial: A; completed: boolean; onBack?: () => void;
  onSaved: (s: TeamSetupState) => void; onDraft: (s: TeamSetupState) => void;
}) {
  const [a, setA] = useState<A>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirty = useRef(false);
  const c = CHARACTERS[KIND_CHARACTER[kind]];
  const fields = FIELDS[kind].filter((f) => !f.showIf || f.showIf(a));
  const set = (k: string, v: unknown) => { dirty.current = true; setA((p) => { const n = { ...p }; if (v === undefined || v === "") delete n[k]; else n[k] = v; return n; }); };

  // Autosave drafts of an unfinished stage so answers survive leaving or refreshing.
  useEffect(() => {
    if (completed || !dirty.current) return;
    const t = setTimeout(async () => {
      setDraftState("saving");
      try { onDraft(await saveSetupStage(kind, clean(a, fields), false)); setDraftState("saved"); }
      catch { setDraftState("failed"); }
    }, 800);
    return () => clearTimeout(t);
  }, [a]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr(null);
    const answers = clean(a, fields);
    const parsed = SETUP_SCHEMAS[kind].safeParse(answers);
    if (!parsed.success) {
      const issue = parsed.error.errors[0]!;
      const f = FIELDS[kind].find((x) => x.key === issue.path[0]);
      setErr(`${f ? f.label.replace(/\s*\(optional\)/, "") + ": " : ""}${issue.message === "Required" ? "please answer this question." : issue.message}`);
      return;
    }
    setSaving(true);
    try { onSaved(await saveSetupStage(kind, answers, true)); }
    catch (e) { setErr((e as Error).message || "Could not save. Your answers are kept — please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className={`glass-panel p-5 sm:p-7 space-y-6 border ${c.theme.border}`}>
      <div className="flex items-center gap-3">
        <img src={c.image} alt={c.name} className="w-12 h-12 rounded-full object-cover object-top" />
        <div>
          <h1 className={`font-display text-xl font-bold ${c.theme.text}`}>{c.name} Setup</h1>
          <p className="text-white/60 text-sm">{KIND_LABEL[kind]}{completed ? " — saved. You can update your answers." : ""}</p>
        </div>
      </div>
      {fields.map((f) => <FieldInput key={f.key} f={f} value={a[f.key]} onChange={(v) => set(f.key, v)} />)}
      {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
      <div className="flex items-center justify-between gap-2">
        {onBack ? <Button variant="ghost" className="text-white/70" onClick={onBack}>Back</Button> : <span />}
        <span className="text-xs text-white/40">
          {draftState === "saving" ? "Saving draft..." : draftState === "saved" ? "Draft saved" : draftState === "failed" ? "Draft not saved" : ""}
        </span>
        <Button disabled={saving} onClick={submit} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{completed ? "Save changes" : "Save and continue"}
        </Button>
      </div>
    </div>
  );
}

// Drop answers of hidden questions and empty values before saving.
function clean(a: A, fields: Field[]): A {
  const keys = new Set(fields.map((f) => f.key));
  return Object.fromEntries(Object.entries(a).filter(([k, v]) => keys.has(k) && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
}

const chip = (sel: boolean) =>
  `rounded-xl border px-3 py-2 text-sm text-left transition-colors ${sel ? "border-purple-400 bg-purple-600/20 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`;

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const [customText, setCustomText] = useState("");
  const arr = Array.isArray(value) ? (value as string[]) : [];
  return (
    <fieldset className="space-y-2">
      <legend className="text-white font-medium mb-2">{f.label}</legend>
      {f.why && <p className="text-white/45 text-xs -mt-1 mb-2">{f.why}</p>}
      {f.type === "single" && (
        <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {f.options!.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} className={chip(value === o)}
              onClick={() => onChange(value === o && f.optional ? undefined : o)}>{o}</button>
          ))}
        </div>
      )}
      {f.type === "multi" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[...f.options!, ...arr.filter((x) => !f.options!.includes(x))].map((o) => {
              const sel = arr.includes(o);
              return (
                <button key={o} type="button" role="checkbox" aria-checked={sel} className={chip(sel)}
                  onClick={() => onChange(sel ? arr.filter((x) => x !== o) : [...arr, o])}>
                  {sel && <Check className="inline w-3.5 h-3.5 mr-1 text-purple-300" />}{o}
                </button>
              );
            })}
          </div>
          {f.custom && (
            <div className="flex gap-2">
              <Input value={customText} maxLength={60} onChange={(e) => setCustomText(e.target.value)} placeholder="Add your own" className="glass-input text-white" />
              <Button type="button" variant="ghost" className="text-white/70" disabled={!customText.trim()}
                onClick={() => { const t = customText.trim(); if (t && !arr.includes(t)) onChange([...arr, t]); setCustomText(""); }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
      {f.type === "text" && (
        <Input value={(value as string) ?? ""} maxLength={80} onChange={(e) => onChange(e.target.value)} className="glass-input text-white" />
      )}
      {f.type === "number" && (
        <div className="flex items-center gap-2 max-w-[220px]">
          <Input type="number" inputMode="decimal" value={value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} className="glass-input text-white" />
          <span className="text-white/60 text-sm">{f.unit}</span>
        </div>
      )}
      {f.type === "scale" && (
        <div className="flex gap-2 items-center">
          <span className="text-white/40 text-xs">Low</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} className={`${chip(value === n)} w-10 text-center`}
              onClick={() => onChange(value === n ? undefined : n)}>{n}</button>
          ))}
          <span className="text-white/40 text-xs">High</span>
        </div>
      )}
      {f.type === "subjects" && <Subjects value={(value as { name: string; level: string }[]) ?? []} onChange={onChange} />}
    </fieldset>
  );
}

function Subjects({ value, onChange }: { value: { name: string; level: string }[]; onChange: (v: unknown) => void }) {
  const [name, setName] = useState("");
  const add = () => { const n = name.trim(); if (n && !value.some((s) => s.name.toLowerCase() === n.toLowerCase())) onChange([...value, { name: n, level: "Beginner" }]); setName(""); };
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={s.name} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <span className="text-white flex-1 min-w-[120px]">{s.name}</span>
          {LEVELS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={s.level === l} className={`${chip(s.level === l)} py-1 text-xs`}
              onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, level: l } : x)))}>{l}</button>
          ))}
          <button type="button" aria-label={`Remove ${s.name}`} className="text-white/50 hover:text-white" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {value.length < 8 && (
        <div className="flex gap-2">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="e.g. English, Python, Guitar" className="glass-input text-white" />
          <Button type="button" variant="ghost" className="text-white/70" disabled={!name.trim()} onClick={add}><Plus className="w-4 h-4" /> Add</Button>
        </div>
      )}
    </div>
  );
}
