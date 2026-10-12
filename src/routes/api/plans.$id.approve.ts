import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";
import { approveDraft, PlanError } from "@/server/plans.server";
import { tzFrom } from "@/server/storage.server";

export const Route = createFileRoute("/api/plans/$id/approve")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        try {
          return Response.json(await approveDraft(uid, params.id, tzFrom(new URL(request.url).searchParams.get("tz"))));
        } catch (e) {
          if (e instanceof PlanError) return Response.json({ message: e.message }, { status: e.status });
          console.error(e);
          return Response.json({ message: "The plan could not be saved. Nothing was approved — please try again." }, { status: 500 });
        }
      },
    },
  },
});
