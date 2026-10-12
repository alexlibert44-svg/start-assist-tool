import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "@/components/pages/profile";
import { LarryOnlyRoute } from "@/components/larry-only";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Larry" },
      { name: "description", content: "View and edit the profile you shared with Larry." },
      { property: "og:title", content: "My Profile — Larry" },
      { property: "og:description", content: "View and edit the profile you shared with Larry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LarryOnlyRoute component={ProfilePage} />,
});
