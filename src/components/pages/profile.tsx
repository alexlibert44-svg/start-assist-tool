import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTeamSetup } from "@/hooks/use-team-setup";
import { KIND_LABEL } from "@/shared/team-setup";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { GOALS, CHALLENGES, PHONE_USAGE, SITUATIONS } from "@/lib/onboarding";

type Field = { key: "preferredName" | "primaryGoal" | "biggestChallenge" | "phoneUsage" | "currentSituation"; label: string; options?: string[] };
const FIELDS: Field[] = [
  { key: "preferredName", label: "Preferred name" },
  { key: "primaryGoal", label: "Primary goal", options: GOALS },
  { key: "biggestChallenge", label: "Biggest current challenge", options: CHALLENGES },
  { key: "phoneUsage", label: "Daily phone usage", options: PHONE_USAGE },
  { key: "currentSituation", label: "Current situation", options: SITUATIONS },
];

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-white/40 text-sm">Loading profile...</div>;
  if (error || !profile) return <div className="p-8 text-red-400 text-sm">Could not load your profile.</div>;

  const startEdit = () => {
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, (profile[f.key] as string | null) ?? ""])));
    setSaveError(null);
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!draft["preferredName"]?.trim()) { setSaveError("Preferred name is required."); return; }
    try {
      await update.mutateAsync({ ...draft, preferredName: draft["preferredName"].trim(), name: draft["preferredName"].trim() });
      setEditing(false);
    } catch { setSaveError("Could not save your changes. Please try again."); }
  };
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">My Profile</h1>
          {!editing && <Button onClick={startEdit} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">Edit Profile</Button>}
        </div>
        <div className="glass-panel p-5 sm:p-6 space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 items-center">
              <span className="text-white/50 text-sm">{f.label}</span>
              {editing ? (
                f.options ? (
                  <select
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="glass-input rounded-md px-3 py-2 text-white bg-black/40"
                  >
                    <option value="">Not set</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input maxLength={40} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} className="glass-input text-white" />
                )
              ) : (
                <span className="text-white">{(profile[f.key] as string | null) || <span className="text-white/35">Not set</span>}</span>
              )}
            </div>
          ))}
          <div className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4">
            <span className="text-white/50 text-sm">Onboarding</span>
            <span className="text-white">{profile.onboardingCompleted ? "Completed" : "Not completed"}</span>
          </div>
          {editing && (
            <div className="flex justify-end gap-2 pt-2">
              {saveError && <p className="text-red-400 text-sm mr-auto self-center">{saveError}</p>}
              <Button variant="ghost" onClick={() => setEditing(false)} className="text-white/70">Cancel</Button>
              <Button onClick={saveEdit} disabled={update.isPending} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">Save</Button>
            </div>
          )}
        </div>
        <TeamProfiles />
        <Button variant="ghost" onClick={signOut} className="text-white/60 hover:text-white">Sign out</Button>
      </div>
    </div>
  );
}

function TeamProfiles() {
  const { data, error } = useTeamSetup();
  if (error) return <div className="glass-panel p-5 text-red-400 text-sm">Could not load your team profiles.</div>;
  if (!data) return null;
  return (
    <div className="glass-panel p-5 sm:p-6 space-y-3">
      <h2 className="text-white font-semibold">Team profiles</h2>
      {data.stages.map((s) => (
        <div key={s.kind} className="flex items-center justify-between gap-3">
          <div>
            <div className="text-white text-sm">{KIND_LABEL[s.kind]} <span className="text-white/45">· {s.character}</span></div>
            <div className="text-xs text-white/50">{s.completedAt ? "Ready" : "Not completed"}</div>
          </div>
          <Link to="/team-setup" search={s.completedAt ? { edit: s.kind } : {}} className="text-sm text-purple-300 hover:text-purple-200">
            {s.completedAt ? "Review / edit" : "Continue setup"}
          </Link>
        </div>
      ))}
    </div>
  );
}
