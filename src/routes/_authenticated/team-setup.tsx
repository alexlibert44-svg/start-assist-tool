import { createFileRoute } from "@tanstack/react-router";
import TeamSetupPage from "@/components/pages/team-setup";
import { SETUP_KINDS, type SetupKind } from "@/shared/team-setup";

export const Route = createFileRoute("/_authenticated/team-setup")({
  validateSearch: (s: Record<string, unknown>): { edit?: SetupKind } =>
    SETUP_KINDS.includes(s["edit"] as SetupKind) ? { edit: s["edit"] as SetupKind } : {},
  head: () => ({
    meta: [
      { title: "Team Setup — Your Time with Larry AI" },
      { name: "description", content: "Sensei, Hassan and Dr. Neo each get to know you so Larry can plan with you." },
      { property: "og:title", content: "Team Setup — Your Time with Larry AI" },
      { property: "og:description", content: "Sensei, Hassan and Dr. Neo each get to know you so Larry can plan with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { edit } = Route.useSearch();
  return <TeamSetupPage key={edit ?? "flow"} edit={edit} />;
}
