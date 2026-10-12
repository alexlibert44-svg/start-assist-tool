import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamSetup } from "@/hooks/use-team-setup";
import { KIND_LABEL } from "@/shared/team-setup";

// Larry's Command Center: shown once all three specialist profiles are saved and no plan exists yet.
export function CommandCenter() {
  const navigate = useNavigate();
  const { data } = useTeamSetup();
  const plans = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => { const r = await fetch("/api/plans"); if (!r.ok) throw new Error(); return (await r.json()) as unknown[]; },
    enabled: !!data?.completedAt,
  });
  if (!data?.completedAt || !plans.data || plans.data.length > 0) return null;
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
      <Button onClick={() => navigate({ to: "/plans" })} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        Build My First Week
      </Button>
    </div>
  );
}
