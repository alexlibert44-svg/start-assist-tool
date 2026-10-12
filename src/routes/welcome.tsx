import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — Your Time with Larry AI" },
      { name: "description", content: "An intelligent system that helps you organize your life, build positive habits and achieve your goals." },
      { property: "og:title", content: "Welcome — Your Time with Larry AI" },
      { property: "og:description", content: "An intelligent system that helps you organize your life, build positive habits and achieve your goals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const start = async () => {
    const { data } = await supabase.auth.getSession();
    navigate({ to: data.session ? "/onboarding" : "/auth" });
  };
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-panel max-w-lg w-full p-8 sm:p-10 text-center space-y-6"
      >
        <h1 className="font-display font-bold text-3xl text-white leading-tight">Welcome to Your Time with Larry AI</h1>
        <p className="text-white/75 leading-relaxed">
          “An intelligent system that helps you organize your life, build positive habits, develop your skills, and achieve your goals step by step.”
        </p>
        <Button size="lg" onClick={start} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90">
          Start
        </Button>
      </motion.div>
    </div>
  );
}
