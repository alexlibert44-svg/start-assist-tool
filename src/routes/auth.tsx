import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Your Time with Larry AI" },
      { name: "description", content: "Sign in to save your profile, conversations, habits and points." },
      { property: "og:title", content: "Sign in — Your Time with Larry AI" },
      { property: "og:description", content: "Sign in to save your profile, conversations, habits and points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in (now or after the Google redirect) → the splash decides onboarding vs. app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) navigate({ to: "/", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const google = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setError("Google sign-in did not complete. Please try again."); setBusy(false); return; }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="glass-panel max-w-sm w-full p-8 text-center space-y-5">
        <h1 className="font-display font-bold text-2xl text-white">Sign in</h1>
        <p className="text-white/60 text-sm">Your profile, conversations, habits and points are saved to your account.</p>
        <Button size="lg" onClick={google} disabled={busy} className="w-full bg-white text-black hover:bg-white/90">
          {busy ? "Opening Google..." : "Continue with Google"}
        </Button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
