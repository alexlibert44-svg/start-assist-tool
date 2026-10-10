import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/shared/routes";
import { storage, zodError } from "@/server/storage.server";

export const Route = createFileRoute("/api/habits/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const id = parseInt(params.id);
          const input = api.habits.update.input.parse(await request.json());
          const current = (await storage.getHabits()).find((h) => h.id === id);
          if (!current) return Response.json({ message: "Habit not found" }, { status: 404 });

          // Points are awarded/deducted idempotently inside storage.setCompletion
          const item = await storage.updateHabit(id, input);
          if (!item) return Response.json({ message: "Habit not found" }, { status: 404 });

          return Response.json(item);
        } catch (err) {
          if (err instanceof z.ZodError) return zodError(err);
          throw err;
        }
      },
      DELETE: async ({ params }) => {
        try {
          const id = parseInt(params.id);
          if (isNaN(id)) return Response.json({ message: "Invalid habit id" }, { status: 400 });
          const habit = (await storage.getHabits()).find((h) => h.id === id);
          if (!habit) return Response.json({ message: "Habit not found" }, { status: 404 });
          const deleted = await storage.deleteHabit(id);
          if (!deleted) return Response.json({ message: "Habit not found" }, { status: 404 });
          return new Response(null, { status: 204 });
        } catch (err) {
          console.error("DELETE habit error:", err);
          return Response.json({ message: "Failed to delete habit" }, { status: 500 });
        }
      },
    },
  },
});
