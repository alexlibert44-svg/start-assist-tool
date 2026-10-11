import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createConversationRequest, fetchConversations } from "@/hooks/use-conversations";
import { useCharacter } from "@/store/use-character";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Larry — Your Focus & Discipline Coach" },
      { name: "description", content: "Chat with Larry, Sensei, Dr Neo and Hassan to reclaim your time and focus." },
      { property: "og:title", content: "Larry — Your Focus & Discipline Coach" },
      { property: "og:description", content: "Chat with Larry, Sensei, Dr Neo and Hassan to reclaim your time and focus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpenLatestConversation,
});

// "/" opens the most recent conversation (or starts a Larry conversation when none exist).
function OpenLatestConversation() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const list = await fetchConversations();
        const active = useCharacter.getState().activeCharacterId;
        const target = list.find((c) => c.characterId === active) ?? list[0] ?? (await createConversationRequest("Larry"));
        await navigate({ to: "/chat/$conversationId", params: { conversationId: target.id }, replace: true });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [navigate]);

  return (
    <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
      {error ? `Could not open your conversations: ${error}` : "Loading conversations..."}
    </div>
  );
}
