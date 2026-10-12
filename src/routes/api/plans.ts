import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/server/auth.server";

// Read-only for now: plans are created by Larry in a later phase. Only the caller's plans are returned.
export const Route = createFileRoute("/api/plans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const uid = await requireUserId(request);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("plans").select("*").eq("user_id", uid).order("created_at", { ascending: false });
        if (error) return Response.json({ message: error.message }, { status: 500 });
        return Response.json(
          (data ?? []).map((p) => ({
            id: p.id, name: p.name, description: p.description, status: p.status,
            startDate: p.start_date, endDate: p.end_date, schedule: p.schedule,
            createdAt: p.created_at, updatedAt: p.updated_at,
          })),
        );
      },
    },
  },
});
