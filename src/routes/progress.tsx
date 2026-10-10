import { createFileRoute } from "@tanstack/react-router";
import ProgressPage from "@/components/pages/progress";
import { LarryOnlyRoute } from "@/components/larry-only";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Points & Progress — Larry" },
      { name: "description", content: "See your discipline score, level and progress over time." },
      { property: "og:title", content: "Points & Progress — Larry" },
      { property: "og:description", content: "See your discipline score, level and progress over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LarryOnlyRoute component={ProgressPage} />,
});
