import { createFileRoute } from "@tanstack/react-router";
import { conversations, ownerFromRequest } from "@/server/conversations.server";
import { isUuid } from "@/shared/conversations";
import { z } from "zod";
import { workflowStateSchema, answerValid } from "@/shared/agent-questions";

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
        const body = (await request.json().catch(() => ({}))) as { title?: unknown; questionDraft?: unknown };
        if (body.questionDraft !== undefined) {
          const parsed = z.object({ messageId: z.number().int().positive(), answers: workflowStateSchema.shape.answers, step: workflowStateSchema.shape.step }).safeParse(body.questionDraft);
          if (!parsed.success) return Response.json({ message: "Invalid answers" }, { status: 400 });
          try {
            const scope = await ownerFromRequest(request);
            const conv = await conversations.getConversation(scope, params.id);
            if (!conv) return notFound();
            const messages = await conversations.getMessages(scope, params.id);
            const message = messages.find((m) => m.id === parsed.data.messageId && m.sender === "Larry");
            const questions = workflowStateSchema.shape.questions.safeParse(message?.metadata["questions"]);
            if (!questions.success || !questions.data.length || parsed.data.step >= questions.data.length) return Response.json({ message: "Question not found" }, { status: 400 });
            if (Object.entries(parsed.data.answers).some(([key, value]) => { const q = questions.data.find((q) => q.key === key); return !q || (value !== "" && value !== null && !answerValid(q, value)); })) return Response.json({ message: "Invalid answer" }, { status: 400 });
            return Response.json(await conversations.updateConversationMetadata(scope, params.id, { ...conv.metadata, questionDraft: parsed.data }));
          } catch (e) { return fail(e, "Could not save answers"); }
        }
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
