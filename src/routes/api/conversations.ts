import { createFileRoute } from "@tanstack/react-router";
import { conversations, ownerFromRequest } from "@/server/conversations.server";
import type { ConversationCharacter } from "@/shared/conversations";

const CHARS = ["Larry", "Sensei", "Dr Neo", "Hassan"];

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const cid = new URL(request.url).searchParams.get("characterId");
          if (cid && !CHARS.includes(cid)) return Response.json({ message: "Unknown characterId" }, { status: 400 });
          return Response.json(await conversations.listConversations(ownerFromRequest(request),
            cid ? { characterId: cid as ConversationCharacter } : undefined));
        } catch (e) {
          console.error(e);
          return Response.json({ message: "Could not load conversations" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { characterId?: string; title?: string };
        if (!body.characterId || !CHARS.includes(body.characterId)) {
          return Response.json({ message: "Valid characterId is required" }, { status: 400 });
        }
        try {
          const conv = await conversations.createConversation(ownerFromRequest(request), {
            characterId: body.characterId as ConversationCharacter, title: body.title,
          });
          return Response.json(conv, { status: 201 });
        } catch (e) {
          console.error(e);
          return Response.json({ message: "Could not create conversation" }, { status: 500 });
        }
      },
    },
  },
});
