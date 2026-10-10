import { createFileRoute } from "@tanstack/react-router";
import ChatPage from "@/components/pages/chat";

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
  component: ChatPage,
});
