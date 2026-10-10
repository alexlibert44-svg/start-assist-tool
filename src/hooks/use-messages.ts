import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertMessage } from "@/shared/routes";
import { useCharacter } from "@/store/use-character";

export function useMessages() {
  const { activeCharacterId } = useCharacter();
  
  return useQuery({
    // Cache by character so conversations are distinct
    queryKey: [api.messages.list.path, activeCharacterId],
    queryFn: async () => {
      // Pass characterId as a query param
      const url = new URL(api.messages.list.path, window.location.origin);
      url.searchParams.append("characterId", activeCharacterId);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return api.messages.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  const { activeCharacterId } = useCharacter();

  return useMutation({
    mutationFn: async (data: InsertMessage) => {
      const validated = api.messages.create.input.parse(data);
      const res = await fetch(api.messages.create.path, {
        method: api.messages.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.messages.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to send message");
      }
      return api.messages.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path, activeCharacterId] });
    },
  });
}
