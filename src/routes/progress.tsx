import { createFileRoute } from "@tanstack/react-router";
import ProgressPage from "@/components/pages/progress";
import { LarryOnlyRoute } from "@/components/larry-only";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Points & Progress — Larry" },
      { name: "description", content: "See your total points, consecutive active days and daily completion rate." },
      { property: "og:title", content: "Points & Progress — Larry" },
      { property: "og:description", content: "See your total points, consecutive active days and daily completion rate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LarryOnlyRoute component={ProgressPage} />,
});
