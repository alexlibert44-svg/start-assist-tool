import { useEffect, useRef, useState } from "react";
import { AgentAnswer, answerValid } from "@/components/agent-question";
import { Button } from "@/components/ui/button";
import type { AgentQuestion } from "@/shared/agent-questions";

export function PlanningQuestions({ questions, onAnswer, disabled, initial, onSave }: { questions: AgentQuestion[]; onAnswer: (text: string) => Promise<void>; disabled: boolean; initial?: { answers: Record<string, unknown>; step: number }; onSave: (answers: Record<string, unknown>, step: number) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial?.answers ?? {});
  const [step, setStep] = useState(Math.min(initial?.step ?? 0, questions.length - 1));
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => { void onSave(answers, step).then(() => setError(null)).catch(() => setError("Answers not saved. Please try again.")); }, 500);
    return () => clearTimeout(timer);
  }, [answers, step]);
  const q = questions[step];
  if (!q) return null;
  return <div className="agent-larry border-t border-agent/40 mt-5 pt-5 space-y-4">
    <AgentAnswer question={q} value={answers[q.key]} onChange={(v) => { dirty.current = true; setAnswers((a) => ({ ...a, [q.key]: v })); }} />
    {error && <p role="alert" className="text-foreground">{error}</p>}
    <div className="flex justify-between gap-2">
      <Button variant="ghost" disabled={disabled || step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
      <Button className="agent-action" disabled={disabled || !answerValid(q, answers[q.key])} onClick={async () => {
        try {
          await onSave(answers, Math.min(step + 1, questions.length - 1)); setError(null);
          if (step < questions.length - 1) { setStep((s) => s + 1); return; }
          await onAnswer(questions.map((question) => `${question.label}: ${Array.isArray(answers[question.key]) ? (answers[question.key] as string[]).join(", ") : answers[question.key] ?? "Skipped"}`).join("\n"));
        } catch { setError("Answers not saved. Please try again."); }
      }}>{step < questions.length - 1 ? "Next" : "Send answers"}</Button>
    </div>
  </div>;
}