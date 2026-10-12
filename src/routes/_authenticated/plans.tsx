import { createFileRoute } from "@tanstack/react-router";
import PlansPage from "@/components/pages/plans";
import { LarryOnlyRoute } from "@/components/larry-only";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "My Plans — Larry" },
      { name: "description", content: "Your active and previous plans created with Larry." },
      { property: "og:title", content: "My Plans — Larry" },
      { property: "og:description", content: "Your active and previous plans created with Larry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LarryOnlyRoute component={PlansPage} />,
});
