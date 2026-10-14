import { useState } from "react";
import { AgentAnswer, answerValid } from "@/components/agent-question";
import { Button } from "@/components/ui/button";
import type { AgentQuestion } from "@/shared/agent-questions";

export function PlanningQuestions({ questions, onAnswer, disabled }: { questions: AgentQuestion[]; onAnswer: (text: string) => Promise<void>; disabled: boolean }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const q = questions[step];
  if (!q) return null;
  return <div className="agent-larry border-t border-agent/40 mt-5 pt-5 space-y-4">
    <AgentAnswer question={q} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
    <div className="flex justify-between gap-2">
      <Button variant="ghost" disabled={disabled || step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
      <Button className="agent-action" disabled={disabled || !answerValid(q, answers[q.key])} onClick={async () => {
        if (step < questions.length - 1) { setStep((s) => s + 1); return; }
        await onAnswer(questions.map((question) => `${question.label}: ${Array.isArray(answers[question.key]) ? (answers[question.key] as string[]).join(", ") : answers[question.key] ?? "Skipped"}`).join("\n"));
      }}>{step < questions.length - 1 ? "Next" : "Send answers"}</Button>
    </div>
  </div>;
}