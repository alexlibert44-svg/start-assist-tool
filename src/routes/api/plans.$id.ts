import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";
import { PlanError, rejectDraft, updateDraft } from "@/server/plans.server";

const fail = (e: unknown) => {
  if (e instanceof PlanError) return Response.json({ message: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ message: "Could not save the plan. Please try again." }, { status: 500 });
};

export const Route = createFileRoute("/api/plans/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const uid = await requireUserId(request);
        try {
          const body = (await request.json()) as { items?: unknown };
          if (!Array.isArray(body.items)) return Response.json({ message: "items required" }, { status: 400 });
          return Response.json(await updateDraft(uid, params.id, body.items));
        } catch (e) { return fail(e); }
      },
      DELETE: async ({ request, params }) => {
        const uid = await requireUserId(request);
        try { await rejectDraft(uid, params.id); return new Response(null, { status: 204 }); } catch (e) { return fail(e); }
      },
    },
  },
});
