import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/shared/routes";
import { storageForRequest, zodError } from "@/server/storage.server";

export const Route = createFileRoute("/api/messages")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const storage = await storageForRequest(request);
        const characterId = new URL(request.url).searchParams.get("characterId") ?? undefined;
        return Response.json(await storage.getMessages(characterId));
      },
      POST: async ({ request }) => {
        const storage = await storageForRequest(request);
        try {
          const input = api.messages.create.input.parse(await request.json());
          const msg = await storage.createMessage(input);
          // Track message count (focus sessions) but do NOT award any points
          if (input.sender === "user") {
            const prof = await storage.getProfile();
            if (prof) await storage.updateProfile({ focusSessions: (prof.focusSessions ?? 0) + 1 });
          }
          return Response.json(msg, { status: 201 });
        } catch (err) {
          if (err instanceof z.ZodError) return zodError(err);
          throw err;
        }
      },
    },
  },
});
