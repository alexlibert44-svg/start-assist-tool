import { useEffect, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCharacter } from "@/store/use-character";

// Redirects to "/" if the active character is not Larry
export function LarryOnlyRoute({ component: Component }: { component: ComponentType }) {
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);
  const navigate = useNavigate();

  useEffect(() => {
    if (activeCharacterId !== "Larry") navigate({ to: "/" });
  }, [activeCharacterId, navigate]);

  if (activeCharacterId !== "Larry") return null;
  return <Component />;
}
