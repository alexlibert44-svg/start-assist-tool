import { createFileRoute } from "@tanstack/react-router";
import { storage } from "@/server/storage.server";

export const Route = createFileRoute("/api/messages/clear")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const characterId = new URL(request.url).searchParams.get("characterId");
        if (!characterId) return Response.json({ message: "characterId is required" }, { status: 400 });
        await storage.clearMessages(characterId);
        return new Response(null, { status: 204 });
      },
    },
  },
});
