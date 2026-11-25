import { createFileRoute } from "@tanstack/react-router";
import { storageForRequest } from "@/server/storage.server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/api/habits/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const storage = await storageForRequest(request);
        const params = new URL(request.url).searchParams;
        const start = params.get("start") ?? "";
        const end = params.get("end") ?? "";
        if (!DATE.test(start) || !DATE.test(end)) return Response.json({ message: "A valid date range is required." }, { status: 400 });
        const startMs = Date.parse(`${start}T00:00:00Z`);
        const endMs = Date.parse(`${end}T00:00:00Z`);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || endMs - startMs > 6 * 86_400_000) {
          return Response.json({ message: "Choose a date range of seven days or fewer." }, { status: 400 });
        }
        try { return Response.json(await storage.getHabitHistory(start, end)); }
        catch (error) { return Response.json({ message: (error as Error).message }, { status: 500 }); }
      },
    },
  },
});