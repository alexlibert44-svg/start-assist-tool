import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createConversationRequest, fetchConversations } from "@/hooks/use-conversations";
import { useCharacter, CHARACTERS } from "@/store/use-character";
import { nextOnboardingPath } from "@/lib/onboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Time with Larry AI" },
      { name: "description", content: "Larry and his team help you organize your life, build habits and reach your goals step by step." },
      { property: "og:title", content: "Your Time with Larry AI" },
      { property: "og:description", content: "Larry and his team help you organize your life, build habits and reach your goals step by step." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Splash,
});

// Splash: brief branded intro, then welcome / onboarding / latest conversation.
function Splash() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const [next] = await Promise.all([nextOnboardingPath(), new Promise((r) => setTimeout(r, 1100))]);
        if (next !== "app") return navigate({ to: next, replace: true });
        const active = useCharacter.getState().activeCharacterId;
        const list = await fetchConversations(active);
        const target = list[0] ?? (await createConversationRequest(active));
        await navigate({ to: "/chat/$conversationId", params: { conversationId: target.id }, replace: true });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-br from-purple-600 to-indigo-600 shadow-[0_0_40px_rgba(124,58,237,0.45)]"
      >
        <img src={CHARACTERS.Larry.image} alt="Larry" className="w-full h-full rounded-full object-cover" />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="font-display font-bold text-2xl sm:text-3xl tracking-wide text-white"
      >
        Your Time with Larry AI
      </motion.h1>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-white/60"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
      {error && <p className="text-white/50 text-sm">Could not load your app: {error}</p>}
    </div>
  );
}
