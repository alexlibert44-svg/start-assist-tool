import { createFileRoute } from "@tanstack/react-router";
import HabitsPage from "@/components/pages/habits";
import { LarryOnlyRoute } from "@/components/larry-only";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({
    meta: [
      { title: "Habit Tracker — Larry" },
      { name: "description", content: "Track your daily habits and earn discipline points." },
      { property: "og:title", content: "Habit Tracker — Larry" },
      { property: "og:description", content: "Track your daily habits and earn discipline points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LarryOnlyRoute component={HabitsPage} />,
});
