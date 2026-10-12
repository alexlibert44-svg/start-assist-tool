import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireUserId } from "@/server/auth.server";
import { saveStage, SetupError } from "@/server/team-setup.server";
import { zodError } from "@/server/storage.server";
import { SETUP_KINDS, type SetupKind } from "@/shared/team-setup";

export const Route = createFileRoute("/api/team-setup/$kind")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!SETUP_KINDS.includes(params.kind as SetupKind)) return Response.json({ message: "Unknown setup stage." }, { status: 404 });
        try {
          const body = (await request.json()) as { answers?: unknown; complete?: unknown };
          return Response.json(await saveStage(uid, params.kind as SetupKind, body.answers ?? {}, body.complete === true));
        } catch (e) {
          if (e instanceof z.ZodError) return zodError(e);
          if (e instanceof SetupError) return Response.json({ message: e.message }, { status: e.status });
          console.error(e);
          return Response.json({ message: "Could not save. Please try again." }, { status: 500 });
        }
      },
    },
  },
});
