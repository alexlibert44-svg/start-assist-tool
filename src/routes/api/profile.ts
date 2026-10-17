import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/shared/routes";
import { storageForRequest, zodError } from "@/server/storage.server";
import { initialProfileSchema } from "@/shared/onboarding-questions";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const storage = await storageForRequest(request);
        let item = await storage.getProfile();
        if (!item) item = await storage.updateProfile({ name: "Focus Seeker", xp: 0, focusSessions: 0 });
        return Response.json(item);
      },
      PUT: async ({ request }) => {
        const storage = await storageForRequest(request);
        try {
          const input = api.profile.update.input.parse(await request.json());
          if (input.onboardingStep === 5 || input.onboardingCompleted === true) {
            const current = await storage.getProfile();
            initialProfileSchema.parse({ ...current, ...input });
          }
          return Response.json(await storage.updateProfile(input));
        } catch (err) {
          if (err instanceof z.ZodError) return zodError(err);
          throw err;
        }
      },
    },
  },
});
