import { createFileRoute } from "@tanstack/react-router";
import { storageForRequest, tzFrom } from "@/server/storage.server";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const storage = await storageForRequest(request);
        try {
          return Response.json(await storage.getStats(tzFrom(new URL(request.url).searchParams.get("tz"))));
        } catch (e) {
          return Response.json({ message: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
