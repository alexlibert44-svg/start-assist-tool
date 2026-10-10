import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/shared/routes";
import { storage, zodError } from "@/server/storage.server";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async () => {
        let item = await storage.getProfile();
        if (!item) item = await storage.updateProfile({ name: "Focus Seeker", level: 1, xp: 0, focusSessions: 0 });
        return Response.json(item);
      },
      PUT: async ({ request }) => {
        try {
          const input = api.profile.update.input.parse(await request.json());
          return Response.json(await storage.updateProfile(input));
        } catch (err) {
          if (err instanceof z.ZodError) return zodError(err);
          throw err;
        }
      },
    },
  },
});
