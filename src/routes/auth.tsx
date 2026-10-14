import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { CHARACTERS } from "@/store/use-character";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) navigate({ to: "/", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const google = async () => {
    setBusy(true); setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { setError("Google sign-in did not complete. Please try again."); setBusy(false); return; }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: "/", replace: true });
      else { setError("Sign-in did not complete. Please try again."); setBusy(false); }
    } catch { setError("Could not connect to Google. Please try again."); setBusy(false); }
  };

  return (
    <div className="agent-larry min-h-screen px-6 py-8 sm:py-12 flex flex-col">
      <Link to="/welcome" className="inline-flex items-center gap-2 text-muted-foreground text-sm w-fit"><ArrowLeft className="h-4 w-4" />Back</Link>
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-md text-center">
          <img src={CHARACTERS.Larry.image} alt="Larry" className="auth-portrait mx-auto w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover object-top mb-8" />
          <p className="text-agent-ink font-medium text-sm mb-3">YOUR TIME</p>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground leading-tight">Your Time with Larry AI</h1>
          <p className="mt-4 text-muted-foreground text-base">Welcome back. Make time for what matters.</p>
          <div className="mt-10 border-t border-border pt-8 space-y-5">
            <h2 className="text-lg text-foreground">Sign in to your account</h2>
            <Button size="lg" onClick={google} disabled={busy} className="w-full min-h-12 bg-foreground text-background hover:bg-foreground/90">
              {busy ? <Loader2 className="animate-spin" /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.88-1.73 2.99-4.28 2.99-7.36ZM12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.9.6-2.04.97-3.39.97-2.6 0-4.81-1.76-5.6-4.12H3.08v2.59A10 10 0 0 0 12 22ZM6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.08a10 10 0 0 0 0 9.04l3.32-2.59ZM12 5.95c1.47 0 2.79.51 3.83 1.52l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.92 5.48l3.32 2.59A5.97 5.97 0 0 1 12 5.95Z" /></svg>}
              {busy ? "Opening Google..." : "Continue with Google"}
            </Button>
            {error && <p role="alert" className="text-destructive-foreground text-sm">{error}</p>}
            <p className="text-muted-foreground text-xs leading-relaxed">Your conversations, plans and progress stay with your account.</p>
          </div>
          <div className="flex justify-center mt-9 -space-x-2" aria-label="Your team">{Object.values(CHARACTERS).map((c) => <img key={c.id} src={c.image} alt={c.name} className="h-9 w-9 rounded-full object-cover object-top border-2 border-auth-surface" />)}</div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Larry · Sensei · Hassan · Dr. Neo</p>
    </div>
  );
}
