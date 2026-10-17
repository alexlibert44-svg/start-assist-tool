import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { CHARACTERS, type CharacterId } from "@/store/use-character";
import { createConversationRequest, fetchConversations } from "@/hooks/use-conversations";
import { AgentAnswer, saveQuestionProgress } from "@/components/agent-question";
import { workflowStateSchema } from "@/shared/agent-questions";
import { ONBOARDING_QUESTIONS, initialAnswerValid, initialProfileSchema } from "@/shared/onboarding-questions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Getting started — Your Time with Larry AI" },
      { name: "description", content: "Tell Larry a little about yourself so the team can help you." },
      { property: "og:title", content: "Getting started — Your Time with Larry AI" },
      { property: "og:description", content: "Tell Larry a little about yourself so the team can help you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

type Answers = { preferredName: string; primaryGoal: string; biggestChallenge: string; phoneUsage: string; currentSituation: string };
const QUESTIONS = ONBOARDING_QUESTIONS;
const ANALYSIS = 5, TEAM = 6, DONE = 7;

export function Onboarding() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const [step, setStep] = useState<number | null>(null);
  const [a, setA] = useState<Answers>({ preferredName: "", primaryGoal: "", biggestChallenge: "", phoneUsage: "", currentSituation: "" });
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const dirty = useRef(false);
  const [savingNext, setSavingNext] = useState(false);

  // Restore saved answers and progress.
  useEffect(() => {
    if (!profile || step !== null) return;
    const saved: Answers = {
      preferredName: profile.preferredName ?? "", primaryGoal: profile.primaryGoal ?? "",
      biggestChallenge: profile.biggestChallenge ?? "", phoneUsage: profile.phoneUsage ?? "",
      currentSituation: profile.currentSituation ?? "",
    };
    let live = true;
    fetch("/api/agent-questions?workflow=onboarding").then(async (res) => {
      if (!res.ok) throw new Error();
      const parsed = workflowStateSchema.safeParse(await res.json());
      if (live) {
        setA({ ...saved, ...(parsed.success && !profile.onboardingCompleted ? Object.fromEntries(Object.entries(parsed.data.answers).filter(([key, value]) => QUESTIONS.some((q) => q.key === key) && typeof value === "string")) : {}) });
      }
    }).catch(() => { if (live) { setA(saved); setError("Could not restore your draft. Your saved profile is unchanged."); } }).finally(() => {
      if (live) { setStep(profile.onboardingCompleted ? Math.max(TEAM, Math.min(profile.onboardingStep ?? TEAM, DONE)) : Math.min(profile.onboardingStep ?? 0, ANALYSIS)); setRestored(true); }
    });
    return () => { live = false; };
  }, [profile, step]);
  useEffect(() => {
    if (!dirty.current || step === null || step >= QUESTIONS.length || savingNext) return;
    const timer = setTimeout(() => { void saveQuestionProgress("onboarding", a, step).catch(() => setError("Draft not saved. Please try again.")); }, 800);
    return () => clearTimeout(timer);
  }, [a, step, savingNext]);

  if (isLoading || step === null || !restored) {
    return <div className="flex-1 flex items-center justify-center text-foreground/40 text-sm">Loading your progress...</div>;
  }

  const save = async (patch: Record<string, unknown>) => {
    setError(null);
    try { await update.mutateAsync(patch); return true; }
    catch { setError("Could not save. Please check your connection and try again."); return false; }
  };

  const q = QUESTIONS[step];
  const key = q?.key as keyof Answers | undefined;
  const value = key ? a[key].trim() : "";
  const next = async () => {
    if (!q || !key || savingNext || !initialAnswerValid(q, value)) return;
    setSavingNext(true);
    try {
      await saveQuestionProgress("onboarding", a, step);
      const nextStep = step + 1;
      const answers = nextStep === QUESTIONS.length ? initialProfileSchema.parse({ ...a, [key]: value }) : { [key]: value };
      if (await save({ ...answers, ...(key === "preferredName" ? { name: value } : {}), onboardingStep: nextStep })) setStep(nextStep);
    } catch (e) { setError((e as Error).message); }
    finally { setSavingNext(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-8">
      <div className="agent-larry glass-panel w-full max-w-xl p-6 sm:p-8">
        {q && (
          <>
            <div className="flex items-center justify-between text-xs text-foreground/50 mb-2">
              <span>Question {step + 1} of {QUESTIONS.length}</span>
              <span>{Math.round((step / QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/10 mb-6 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-agent to-agent agent-gradient transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AgentAnswer key={q.key} question={q} value={value} onChange={(v) => { dirty.current = true; setA({ ...a, [q.key]: typeof v === "string" ? v : "" }); }} />
              </motion.div>
            </AnimatePresence>
            {!initialAnswerValid(q, value) && <p className="text-foreground/40 text-xs mt-3">{value === "Other" ? "Please add your own answer." : q.type === "text" ? "Please enter a name (up to 40 characters)." : "Choose an option or add your own answer."}</p>}
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex justify-between mt-6">
              <Button variant="ghost" disabled={step === 0 || savingNext} onClick={() => setStep(step - 1)} className="text-foreground/70">Back</Button>
              <Button disabled={!initialAnswerValid(q, value) || update.isPending || savingNext} onClick={next} className="agent-action">
                {step === QUESTIONS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </>
        )}
        {step === ANALYSIS && <Analysis save={save} onDone={() => setStep(TEAM)} onBack={() => setStep(ANALYSIS - 1)} />}
        {step >= TEAM && (
          <TeamIntro
            name={a.preferredName}
            onFinish={async () => {
              if (step < DONE && !(await save({ onboardingStep: DONE }))) return;
              navigate({ to: "/team-setup", replace: true });
            }}
          />
        )}
      </div>
    </div>
  );
}

// Each line is shown while its real step runs, and ticked only after it succeeds.
function Analysis({ save, onDone, onBack }: { save: (p: Record<string, unknown>) => Promise<boolean>; onDone: () => void; onBack: () => void }) {
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);
  const steps = ["Building your profile...", "Preparing your team...", "Initializing your journey..."];

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        // 1. Save the basic profile and mark onboarding answers complete.
        if (!(await save({ onboardingCompleted: true, onboardingStep: TEAM }))) throw new Error();
        setDone(1);
        // 2. Make sure Larry's conversation exists for this account.
        const list = await fetchConversations("Larry");
        if (!list[0]) await createConversationRequest("Larry");
        setDone(2);
        // 3. Load the starting progress (points, today's activities).
        const res = await fetch(`/api/stats?tz=${new Date().getTimezoneOffset()}`);
        if (!res.ok) throw new Error();
        setDone(3);
        setTimeout(onDone, 600);
      } catch {
        setFailed(true);
      }
    })();
  }, [save, onDone]);

  return (
    <div className="space-y-4 py-4">
      <h2 className="font-display text-xl font-bold text-foreground text-center mb-2">Setting things up</h2>
      {steps.map((s, i) => (
        <motion.div key={s} initial={{ opacity: 0 }} animate={{ opacity: i <= done ? 1 : 0.35 }} className="flex items-center gap-3 text-foreground/85">
          {i < done ? <Check className="w-5 h-5 text-emerald-400" /> : i === done && !failed ? <Loader2 className="w-5 h-5 animate-spin text-agent-ink" /> : <span className="w-5 h-5" />}
          <span>{s}</span>
        </motion.div>
      ))}
      <p className="text-foreground/40 text-xs text-center pt-2">This saves your basic profile — no AI analysis runs at this stage.</p>
      {failed && (
        <div className="text-center space-y-2">
          <p className="text-red-400 text-sm">Something didn't save. Please try again.</p>
          <Button variant="ghost" onClick={onBack} className="text-foreground/70">Go back</Button>
        </div>
      )}
    </div>
  );
}

const TEAM_INFO: { id: CharacterId; area: string; intro: string }[] = [
  { id: "Sensei", area: "Learning, education and skill development", intro: "Sensei helps you learn effectively, build study routines and develop new skills." },
  { id: "Hassan", area: "Physical activity, general wellness, nutrition and sleep education", intro: "Hassan gives general guidance on movement, energy, healthy eating and better sleep." },
  { id: "Dr Neo", area: "Habits, behavior, self-awareness and personal development", intro: "Dr. Neo helps you understand your habits and behavior and grow your self-awareness. He does not diagnose." },
];

function TeamIntro({ name, onFinish }: { name: string; onFinish: () => Promise<void> }) {
  const [open, setOpen] = useState<CharacterId | null>(null);
  const [busy, setBusy] = useState(false);
  const larry = CHARACTERS.Larry;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <img src={larry.image} alt="Larry" className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/60" />
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Hi{name ? ` ${name}` : ""}, I'm Larry.</h2>
          <p className="text-foreground/65 text-sm">I coordinate your team and manage your tasks. Meet the specialists:</p>
        </div>
      </div>
      <div className="grid gap-2">
        {TEAM_INFO.map((t) => {
          const c = CHARACTERS[t.id];
          const isOpen = open === t.id;
          return (
            <button key={t.id} onClick={() => setOpen(isOpen ? null : t.id)} className={`text-left rounded-xl border ${c.theme.border} bg-white/5 hover:bg-foreground/10 p-3 transition-colors`}>
              <div className="flex items-center gap-3">
                <img src={c.image} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className={`font-semibold ${c.theme.text}`}>{c.name}</div>
                  <div className="text-foreground/60 text-xs">{t.area}</div>
                </div>
              </div>
              {isOpen && <p className="text-foreground/80 text-sm mt-3">{t.intro}</p>}
            </button>
          );
        })}
      </div>
      <p className="text-foreground/85 italic border-l-2 border-purple-500/60 pl-3">
        “Before I can build a plan that fits you, each member of the team needs to get to know you.”
      </p>
      <Button size="lg" disabled={busy} onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }} className="w-full bg-gradient-to-r from-agent to-agent agent-gradient text-foreground">
        Start Team Setup
      </Button>
    </div>
  );
}
