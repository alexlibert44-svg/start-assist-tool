import { createFileRoute } from "@tanstack/react-router";
import ChatPage from "@/components/pages/chat";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation — Larry Focus Coach" },
      { name: "description", content: "Continue your conversation with Larry, Sensei, Dr Neo or Hassan." },
      { property: "og:title", content: "Conversation — Larry Focus Coach" },
      { property: "og:description", content: "Continue your conversation with Larry, Sensei, Dr Neo or Hassan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationRoute,
});

function ConversationRoute() {
  const { conversationId } = Route.useParams();
  return <ChatPage key={conversationId} conversationId={conversationId} />;
}
