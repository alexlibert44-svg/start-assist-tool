import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";
import { getTeamSetup } from "@/server/team-setup.server";

export const Route = createFileRoute("/api/team-setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const uid = await requireUserId(request);
        try { return Response.json(await getTeamSetup(uid)); }
        catch (e) { console.error(e); return Response.json({ message: "Could not load Team Setup." }, { status: 500 }); }
      },
    },
  },
});
