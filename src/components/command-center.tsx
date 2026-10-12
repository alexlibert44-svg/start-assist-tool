import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamSetup } from "@/hooks/use-team-setup";
import { usePlans, startPlanning } from "@/hooks/use-plans";
import { useCharacter } from "@/store/use-character";
import { queryClient } from "@/lib/queryClient";
import { CONVERSATIONS_KEY } from "@/hooks/use-conversations";
import { KIND_LABEL } from "@/shared/team-setup";

export const PLANNING_KICKOFF = "Let's build my first week.";

// Larry's Command Center: shown once all three specialist profiles are saved, until planning has started.
export function CommandCenter({ planningStarted }: { planningStarted: boolean }) {
  const navigate = useNavigate();
  const handoff = useCharacter((s) => s.handoff);
  const { data } = useTeamSetup();
  const plans = usePlans();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data?.completedAt || !plans.data || plans.data.length > 0 || planningStarted) return null;

  const start = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await startPlanning();
      if (!r.resumed) handoff("Larry", "Larry", PLANNING_KICKOFF, r.conversationId);
      await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      await navigate({ to: "/chat/$conversationId", params: { conversationId: r.conversationId } });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="glass-panel mt-4 p-4 sm:p-5 space-y-3 border border-purple-500/30 shrink-0">
      <div className="text-xs uppercase tracking-wider text-purple-300 font-semibold">Command Center</div>
      <ul className="space-y-1">
        {data.stages.map((s) => (
          <li key={s.kind} className="flex items-center gap-2 text-white/85 text-sm">
            <Check className="w-4 h-4 text-emerald-400" /> {KIND_LABEL[s.kind]} ready.
          </li>
        ))}
      </ul>
      <div className="text-white space-y-0.5">
        <p>Excellent. Now the team has the information needed to help you.</p>
        <p>One final step remains.</p>
        <p className="font-semibold">Let's build your first week.</p>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button onClick={start} disabled={busy} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {error ? "Try again" : "Build My First Week"}
      </Button>
    </div>
  );
}
