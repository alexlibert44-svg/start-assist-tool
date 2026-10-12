import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { CHARACTERS, type CharacterId } from "@/store/use-character";
import { createConversationRequest, fetchConversations } from "@/hooks/use-conversations";
import { GOALS, CHALLENGES, PHONE_USAGE, SITUATIONS } from "@/lib/onboarding";

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
const QUESTIONS: { key: keyof Answers; title: string; options?: string[] }[] = [
  { key: "preferredName", title: "What should we call you?" },
  { key: "primaryGoal", title: "What is your main goal right now?", options: GOALS },
  { key: "biggestChallenge", title: "What is your biggest challenge?", options: CHALLENGES },
  { key: "phoneUsage", title: "About how much time do you spend on your phone each day?", options: PHONE_USAGE },
  { key: "currentSituation", title: "Which best describes your situation?", options: SITUATIONS },
];
const ANALYSIS = 5, TEAM = 6, DONE = 7;

function Onboarding() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const [step, setStep] = useState<number | null>(null);
  const [a, setA] = useState<Answers>({ preferredName: "", primaryGoal: "", biggestChallenge: "", phoneUsage: "", currentSituation: "" });
  const [error, setError] = useState<string | null>(null);

  // Restore saved answers and progress.
  useEffect(() => {
    if (!profile || step !== null) return;
    setA({
      preferredName: profile.preferredName ?? "", primaryGoal: profile.primaryGoal ?? "",
      biggestChallenge: profile.biggestChallenge ?? "", phoneUsage: profile.phoneUsage ?? "",
      currentSituation: profile.currentSituation ?? "",
    });
    setStep(profile.onboardingCompleted ? Math.max(TEAM, Math.min(profile.onboardingStep ?? TEAM, DONE)) : Math.min(profile.onboardingStep ?? 0, ANALYSIS - 1));
  }, [profile, step]);

  if (isLoading || step === null) {
    return <div className="flex-1 flex items-center justify-center text-white/40 text-sm">Loading your progress...</div>;
  }

  const save = async (patch: Record<string, unknown>) => {
    setError(null);
    try { await update.mutateAsync(patch); return true; }
    catch { setError("Could not save. Please check your connection and try again."); return false; }
  };

  const q = QUESTIONS[step];
  const value = q ? a[q.key].trim() : "";
  const next = async () => {
    if (!q || !value) return;
    const nextStep = step + 1;
    if (await save({ [q.key]: value, ...(q.key === "preferredName" ? { name: value } : {}), onboardingStep: nextStep })) setStep(nextStep);
  };

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-8">
      <div className="glass-panel w-full max-w-xl p-6 sm:p-8">
        {q && (
          <>
            <div className="flex items-center justify-between text-xs text-white/50 mb-2">
              <span>Question {step + 1} of {QUESTIONS.length}</span>
              <span>{Math.round((step / QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 mb-6 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-5">{q.title}</h2>
                {q.options ? (
                  <div role="radiogroup" className="grid gap-2">
                    {q.options.map((o) => {
                      const sel = a[q.key] === o;
                      return (
                        <button
                          key={o}
                          role="radio"
                          aria-checked={sel}
                          onClick={() => setA({ ...a, [q.key]: o })}
                          className={`flex items-center justify-between text-left rounded-xl border px-4 py-3 transition-colors ${sel ? "border-purple-400 bg-purple-600/20 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`}
                        >
                          <span>{o}</span>
                          {sel && <Check className="w-4 h-4 text-purple-300" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    autoFocus
                    maxLength={40}
                    value={a.preferredName}
                    onChange={(e) => setA({ ...a, preferredName: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") void next(); }}
                    placeholder="Your name or nickname"
                    className="glass-input text-white"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {!value && <p className="text-white/40 text-xs mt-3">{q.options ? "Choose one option to continue." : "Please enter a name to continue."}</p>}
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex justify-between mt-6">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)} className="text-white/70">Back</Button>
              <Button disabled={!value || update.isPending} onClick={next} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
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
              const list = await fetchConversations("Larry");
              const conv = list[0] ?? (await createConversationRequest("Larry"));
              navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id }, replace: true });
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
      <h2 className="font-display text-xl font-bold text-white text-center mb-2">Setting things up</h2>
      {steps.map((s, i) => (
        <motion.div key={s} initial={{ opacity: 0 }} animate={{ opacity: i <= done ? 1 : 0.35 }} className="flex items-center gap-3 text-white/85">
          {i < done ? <Check className="w-5 h-5 text-emerald-400" /> : i === done && !failed ? <Loader2 className="w-5 h-5 animate-spin text-purple-300" /> : <span className="w-5 h-5" />}
          <span>{s}</span>
        </motion.div>
      ))}
      <p className="text-white/40 text-xs text-center pt-2">This saves your basic profile — no AI analysis runs at this stage.</p>
      {failed && (
        <div className="text-center space-y-2">
          <p className="text-red-400 text-sm">Something didn't save. Please try again.</p>
          <Button variant="ghost" onClick={onBack} className="text-white/70">Go back</Button>
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
  const [setupNote, setSetupNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const larry = CHARACTERS.Larry;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <img src={larry.image} alt="Larry" className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/60" />
        <div>
          <h2 className="font-display text-xl font-bold text-white">Hi{name ? ` ${name}` : ""}, I'm Larry.</h2>
          <p className="text-white/65 text-sm">I coordinate your team and manage your tasks. Meet the specialists:</p>
        </div>
      </div>
      <div className="grid gap-2">
        {TEAM_INFO.map((t) => {
          const c = CHARACTERS[t.id];
          const isOpen = open === t.id;
          return (
            <button key={t.id} onClick={() => setOpen(isOpen ? null : t.id)} className={`text-left rounded-xl border ${c.theme.border} bg-white/5 hover:bg-white/10 p-3 transition-colors`}>
              <div className="flex items-center gap-3">
                <img src={c.image} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className={`font-semibold ${c.theme.text}`}>{c.name}</div>
                  <div className="text-white/60 text-xs">{t.area}</div>
                </div>
              </div>
              {isOpen && <p className="text-white/80 text-sm mt-3">{t.intro}</p>}
            </button>
          );
        })}
      </div>
      <p className="text-white/85 italic border-l-2 border-purple-500/60 pl-3">
        “Before I can build a plan that fits you, each member of the team needs to get to know you.”
      </p>
      {setupNote ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-white/80 text-sm">Team Setup — each specialist's questions — arrives in the next update. For now you can start chatting with Larry and the team.</p>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            Continue to Larry
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => setSetupNote(true)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          Start Team Setup
        </Button>
      )}
    </div>
  );
}
