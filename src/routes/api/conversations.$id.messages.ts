import { createFileRoute } from "@tanstack/react-router";
import { conversations, ownerFromRequest } from "@/server/conversations.server";
import { storageForRequest } from "@/server/storage.server";
import { isUuid } from "@/shared/conversations";

export const Route = createFileRoute("/api/conversations/$id/messages")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!isUuid(params.id)) return Response.json({ message: "Conversation not found" }, { status: 404 });
        const body = (await request.json().catch(() => ({}))) as { sender?: unknown; content?: unknown; metadata?: unknown };
        if (typeof body.sender !== "string" || typeof body.content !== "string" || !body.content.trim()) {
          return Response.json({ message: "sender and content are required" }, { status: 400 });
        }
        try {
          const msg = await conversations.addMessage((await ownerFromRequest(request)), params.id, {
            sender: body.sender, content: body.content,
            metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {},
          });
          // Same focus-session tracking the original messages endpoint does (no points).
          if (body.sender === "user") {
            const storage = await storageForRequest(request);
            const prof = await storage.getProfile();
            if (prof) await storage.updateProfile({ focusSessions: (prof.focusSessions ?? 0) + 1 });
          }
          return Response.json(msg, { status: 201 });
        } catch (e) {
          console.error(e);
          return Response.json({ message: "Could not save message" }, { status: 500 });
        }
      },
      DELETE: async ({ request, params }) => {
        if (!isUuid(params.id)) return Response.json({ message: "Conversation not found" }, { status: 404 });
        try {
          await conversations.clearMessages((await ownerFromRequest(request)), params.id);
          return new Response(null, { status: 204 });
        } catch (e) {
          console.error(e);
          return Response.json({ message: "Could not clear conversation" }, { status: 500 });
        }
      },
    },
  },
});
