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
import { FIELDS, type Field } from "@/shared/question-fields";
import { AgentQuestionStep, answerValid, saveQuestionProgress } from "@/components/agent-question";
import { workflowStateSchema, type AgentQuestion } from "@/shared/agent-questions";

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

  if (isLoading || (!error && !stage)) return <div className="flex-1 flex items-center justify-center text-foreground/40 text-sm">Loading Team Setup...</div>;
  if (error || !data || !stage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-red-300">
        <p>Could not load Team Setup.</p>
        <Button variant="ghost" className="text-foreground/70" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const st = data.stages.find((s) => s.kind === stage);
  if (!st) return null;
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
        <Stepper state={data} current={stage} onPick={(k) => { const s = data.stages.find((x) => x.kind === k); if (s?.completedAt || k === data.currentStage) goTo(k); }} />
        {justDone === stage ? (
          <div className="glass-panel p-6 text-center space-y-4">
            <Check className="w-10 h-10 mx-auto text-emerald-400" />
            <p className="text-foreground text-lg font-semibold">{KIND_DONE_MESSAGE[stage]}</p>
            <p className="text-foreground/60 text-sm">Larry now has your saved {KIND_LABEL[stage].toLowerCase()}.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="ghost" className="text-foreground/70" onClick={() => setJustDone(null)}>Review answers</Button>
              {data.currentStage ? (
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-foreground" onClick={() => data.currentStage && goTo(data.currentStage)}>
                  Continue to {KIND_CHARACTER[data.currentStage]}
                </Button>
              ) : (
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-foreground" onClick={() => void goLarry()}>
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
            onBack={idx > 0 ? () => { const previous = SETUP_KINDS[idx - 1]; if (previous) goTo(previous); } : undefined}
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
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? `${c.theme.border} bg-white/10 text-foreground` : "border-white/10 text-foreground/55"}`}>
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
  const [fieldKey, setFieldKey] = useState(FIELDS[kind][0]?.key ?? "");
  const [ready, setReady] = useState<AgentQuestion | null>(null);
  const [restored, setRestored] = useState(false);
  const [a, setA] = useState<A>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirty = useRef(false);
  const c = CHARACTERS[KIND_CHARACTER[kind]];
  const fields = FIELDS[kind].filter((f) => !f.showIf || f.showIf(a));
  const questionIndex = Math.max(0, fields.findIndex((f) => f.key === fieldKey));
  const currentField = fields[questionIndex];
  const setQuestionIndex = (index: number) => { const field = fields[Math.min(index, fields.length - 1)]; if (field) setFieldKey(field.key); };
  const set = (k: string, v: unknown) => { dirty.current = true; setA((p) => { const n = { ...p }; if (v === undefined || v === "") delete n[k]; else n[k] = v; return n; }); };

  useEffect(() => {
    let live = true;
    fetch(`/api/agent-questions?workflow=${kind}`).then(async (res) => {
      if (!res.ok) throw new Error("Could not restore your questions.");
      const parsed = workflowStateSchema.safeParse(await res.json());
      if (live && parsed.success && !completed) {
        const answers = { ...initial, ...parsed.data.answers };
        const visible = FIELDS[kind].filter((f) => !f.showIf || f.showIf(answers));
        setA(answers); setFieldKey(visible[Math.min(parsed.data.step, visible.length - 1)]?.key ?? visible[0]?.key ?? "");
      }
      if (live) setRestored(true);
    }).catch(() => { if (live) { setErr("Could not restore question progress. Your saved profile is unchanged."); setRestored(true); } });
    return () => { live = false; };
  }, [kind]);

  // Autosave drafts of an unfinished stage so answers survive leaving or refreshing.
  useEffect(() => {
    if (completed || !dirty.current) return;
    const t = setTimeout(async () => {
      setDraftState("saving");
      try { await saveQuestionProgress(kind, a, questionIndex); onDraft(await saveSetupStage(kind, clean(a, fields), false)); setDraftState("saved"); }
      catch { setDraftState("failed"); }
    }, 800);
    return () => clearTimeout(t);
  }, [a]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr(null);
    const answers = clean(a, fields);
    const parsed = SETUP_SCHEMAS[kind].safeParse(answers);
    if (!parsed.success) {
      const issue = parsed.error.errors[0];
      if (!issue) return;
      const f = FIELDS[kind].find((x) => x.key === issue.path[0]);
      setErr(`${f ? f.label.replace(/\s*\(optional\)/, "") + ": " : ""}${issue.message === "Required" ? "please answer this question." : issue.message}`);
      return;
    }
    setSaving(true);
    try { await saveQuestionProgress(kind, answers, fields.length); onSaved(await saveSetupStage(kind, answers, true)); }
    catch (e) { setErr((e as Error).message || "Could not save. Your answers are kept — please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className={`${c.theme.border.split(" ")[0]} glass-panel p-5 sm:p-7 space-y-6 border ${c.theme.border}`}>
      <div className="flex items-center gap-3">
        <img src={c.image} alt={c.name} className="w-12 h-12 rounded-full object-cover object-top" />
        <div>
          <h1 className={`font-display text-xl font-bold ${c.theme.text}`}>{c.name} Setup</h1>
          <p className="text-foreground/60 text-sm">{KIND_LABEL[kind]}{completed ? " — saved. You can update your answers." : ""}</p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Question {Math.min(questionIndex + 1, fields.length)} of {fields.length}</p>
      {restored && currentField && <AgentQuestionStep key={currentField.key} workflow={kind} fieldKey={currentField.key} answers={a} value={a[currentField.key]} onChange={(v) => set(currentField.key, v)} onReady={setReady} />}
      {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={questionIndex === 0 && !onBack || saving} onClick={() => { if (questionIndex > 0) { setReady(null); setQuestionIndex(questionIndex - 1); } else onBack?.(); }}>Back</Button>
        <span className="text-xs text-foreground/40">
          {draftState === "saving" ? "Saving draft..." : draftState === "saved" ? "Draft saved" : draftState === "failed" ? "Draft not saved" : ""}
        </span>
        <Button disabled={saving || !ready || !answerValid(ready, a[ready.key])} onClick={async () => {
          if (questionIndex >= fields.length - 1) { await submit(); return; }
          setSaving(true); setErr(null);
          try { if (!completed) onDraft(await saveSetupStage(kind, clean(a, fields), false)); await saveQuestionProgress(kind, a, questionIndex + 1); setReady(null); setQuestionIndex(questionIndex + 1); }
          catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
        }} className="agent-action">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{questionIndex < fields.length - 1 ? "Next" : completed ? "Save changes" : "Save and continue"}
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

