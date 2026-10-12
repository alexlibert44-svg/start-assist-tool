import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";
import { listPlans } from "@/server/plans.server";
import { tzFrom } from "@/server/storage.server";

// Only the caller's plans; activity completion is read from the linked habit/task records.
export const Route = createFileRoute("/api/plans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const uid = await requireUserId(request);
        try { return Response.json(await listPlans(uid, tzFrom(new URL(request.url).searchParams.get("tz")))); }
        catch (e) { console.error(e); return Response.json({ message: "Could not load plans." }, { status: 500 }); }
      },
    },
  },
});
