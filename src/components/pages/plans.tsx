import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

export type Plan = {
  id: string; name: string; description: string | null; status: string;
  startDate: string | null; endDate: string | null; createdAt: string; updatedAt: string;
  // Future: weekly schedule items { day, activity, durationMinutes, completed }
  schedule: unknown[];
};

export default function PlansPage() {
  const { data: plans, isLoading, error } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-white/40 text-sm">Loading plans...</div>;
  if (error) return <div className="p-8 text-red-400 text-sm">Could not load your plans.</div>;

  const active = (plans ?? []).filter((p) => p.status === "active");
  const previous = (plans ?? []).filter((p) => p.status !== "active");
  const detail = (plans ?? []).find((p) => p.id === selected);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">My Plans</h1>
        {plans?.length === 0 ? (
          <div className="glass-panel p-8 text-center space-y-3">
            <ClipboardList className="w-10 h-10 mx-auto text-purple-300/70" />
            <p className="text-white font-medium">You don't have a plan yet.</p>
            <p className="text-white/50 text-sm">Larry will build your weekly plan after Team Setup, in a coming update. Saved plans will appear here.</p>
          </div>
        ) : (
          <>
            <Section title="Active plan" plans={active} empty="No active plan." onSelect={setSelected} />
            <Section title="Previous plans" plans={previous} empty="No previous plans." onSelect={setSelected} />
          </>
        )}
        {detail && (
          <div className="glass-panel p-5 space-y-2">
            <h2 className="font-display text-xl font-bold text-white">{detail.name}</h2>
            <p className="text-white/50 text-xs uppercase tracking-wider">{detail.status}</p>
            {detail.description && <p className="text-white/80">{detail.description}</p>}
            <p className="text-white/60 text-sm">
              {detail.startDate ? `From ${detail.startDate}` : "No start date"}{detail.endDate ? ` to ${detail.endDate}` : ""}
            </p>
            <p className="text-white/40 text-sm">{detail.schedule.length ? `${detail.schedule.length} scheduled activities` : "No scheduled activities yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, plans, empty, onSelect }: { title: string; plans: Plan[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <h2 className="text-white/40 text-xs uppercase tracking-wider">{title}</h2>
      {plans.length === 0 ? (
        <p className="text-white/40 text-sm">{empty}</p>
      ) : (
        plans.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className="glass-panel w-full text-left p-4 hover:bg-white/10 transition-colors">
            <div className="text-white font-medium">{p.name}</div>
            <div className="text-white/50 text-xs">Created {new Date(p.createdAt).toLocaleDateString()}</div>
          </button>
        ))
      )}
    </div>
  );
}
