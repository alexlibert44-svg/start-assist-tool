import { createFileRoute } from "@tanstack/react-router";
import { conversations, ownerFromRequest } from "@/server/conversations.server";
import { isUuid } from "@/shared/conversations";

const notFound = () => Response.json({ message: "Conversation not found" }, { status: 404 });
const fail = (e: unknown, msg: string) => { console.error(e); return Response.json({ message: msg }, { status: 500 }); };

export const Route = createFileRoute("/api/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isUuid(params.id)) return notFound();
        try {
          const scope = (await ownerFromRequest(request));
          const conv = await conversations.getConversation(scope, params.id);
          if (!conv) return notFound();
          return Response.json({ conversation: conv, messages: await conversations.getMessages(scope, params.id) });
        } catch (e) { return fail(e, "Could not load conversation"); }
      },
      PATCH: async ({ request, params }) => {
        if (!isUuid(params.id)) return notFound();
        const body = (await request.json().catch(() => ({}))) as { title?: unknown };
        const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
        if (!title) return Response.json({ message: "Title cannot be empty" }, { status: 400 });
        try {
          const conv = await conversations.updateConversationTitle((await ownerFromRequest(request)), params.id, title);
          return conv ? Response.json(conv) : notFound();
        } catch (e) { return fail(e, "Could not rename conversation"); }
      },
      DELETE: async ({ request, params }) => {
        if (!isUuid(params.id)) return notFound();
        try {
          const ok = await conversations.deleteConversation((await ownerFromRequest(request)), params.id);
          return ok ? new Response(null, { status: 204 }) : notFound();
        } catch (e) { return fail(e, "Could not delete conversation"); }
      },
    },
  },
});
