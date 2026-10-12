import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";
import { getTeamSetup } from "@/server/team-setup.server";
import { conversations } from "@/server/conversations.server";
import { getDraft } from "@/server/plans.server";
import { KIND_LABEL } from "@/shared/team-setup";

// Starts or resumes the first-week planning session in a Larry conversation (no duplicates on repeated clicks).
export const Route = createFileRoute("/api/plans/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const uid = await requireUserId(request);
        try {
          const setup = await getTeamSetup(uid);
          const missing = setup.stages.filter((s) => !s.completedAt).map((s) => KIND_LABEL[s.kind]);
          if (missing.length) return Response.json({ message: `Please complete these first: ${missing.join(", ")}.` }, { status: 409 });
          const scope = { userId: uid };
          const larry = await conversations.listConversations(scope, { characterId: "Larry", limit: 50 });
          const draft = await getDraft(uid);
          const session = (draft?.conversationId && larry.find((c) => c.id === draft.conversationId))
            || larry.find((c) => c.metadata["planning"] === "first_week");
          if (session) return Response.json({ conversationId: session.id, resumed: true, hasDraft: !!draft });
          const conv = larry[0] ?? (await conversations.createConversation(scope, { characterId: "Larry", title: "My first week" }));
          await conversations.updateConversationMetadata(scope, conv.id, { planning: "first_week", planningStartedAt: new Date().toISOString() });
          return Response.json({ conversationId: conv.id, resumed: false, hasDraft: false });
        } catch (e) {
          console.error(e);
          return Response.json({ message: "Could not start planning. Please try again." }, { status: 500 });
        }
      },
    },
  },
});
