import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/shared/routes";
import { storageForRequest, zodError, tzFrom } from "@/server/storage.server";

export const Route = createFileRoute("/api/habits")({
  server: {
    handlers: {
      GET: async ({ request }) => Response.json(await (await storageForRequest(request)).getHabits(tzFrom(new URL(request.url).searchParams.get("tz")))),
      POST: async ({ request }) => {
        const storage = await storageForRequest(request);
        try {
          const input = api.habits.create.input.parse(await request.json());
          return Response.json(await storage.createHabit(input, tzFrom(new URL(request.url).searchParams.get("tz"))), { status: 201 });
        } catch (err) {
          if (err instanceof z.ZodError) return zodError(err);
          throw err;
        }
      },
    },
  },
});
