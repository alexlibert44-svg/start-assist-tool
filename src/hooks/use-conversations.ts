import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { Conversation, ConversationCharacter, ConversationMessage } from "@/shared/conversations";

export const CONVERSATIONS_KEY = ["/api/conversations"];
export const conversationKey = (id: string) => ["/api/conversations", id];

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? fallback);
  }
  return (await res.json()) as T;
}

export const characterConversationsKey = (characterId: ConversationCharacter) => ["/api/conversations", "character", characterId];

export async function fetchConversations(characterId?: ConversationCharacter): Promise<Conversation[]> {
  const url = characterId ? `/api/conversations?characterId=${encodeURIComponent(characterId)}` : "/api/conversations";
  return json(await fetch(url), "Failed to load conversations");
}

export async function createConversationRequest(characterId: ConversationCharacter): Promise<Conversation> {
  return json(
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    }),
    "Failed to create conversation",
  );
}

export function useConversations() {
  return useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: () => fetchConversations() });
}

/** Conversations owned by one character only (filtered server-side by character_id). */
export function useCharacterConversations(characterId: ConversationCharacter) {
  return useQuery({ queryKey: characterConversationsKey(characterId), queryFn: () => fetchConversations(characterId) });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKey(id),
    queryFn: async () =>
      json<{ conversation: Conversation; messages: ConversationMessage[] }>(
        await fetch(`/api/conversations/${encodeURIComponent(id)}`),
        "Conversation not found",
      ),
    staleTime: 0,
  });
}

export async function addMessageRequest(conversationId: string, sender: string, content: string, metadata: Record<string, unknown> = {}) {
  return json<ConversationMessage>(
    await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, content, metadata }),
    }),
    "Failed to save message",
  );
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      json<Conversation>(
        await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }),
        "Failed to rename conversation",
      ),
    onSuccess: (conv) => {
      qc.setQueriesData<Conversation[]>({ queryKey: CONVERSATIONS_KEY }, (list) => (Array.isArray(list) ? list.map((c) => (c.id === conv.id ? conv : c)) : list));
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Failed to delete conversation");
      }
      return id;
    },
    onSuccess: (id) => {
      qc.setQueriesData<Conversation[]>({ queryKey: CONVERSATIONS_KEY }, (list) => (Array.isArray(list) ? list.filter((c) => c.id !== id) : list));
      qc.removeQueries({ queryKey: conversationKey(id), exact: true });
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** Open the most recent conversation with a character, or create one if none exists. */
export function useOpenCharacter() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useCallback(
    async (characterId: ConversationCharacter, opts?: { forceNew?: boolean }) => {
      let target: Conversation | undefined;
      if (!opts?.forceNew) {
        const list = await qc.fetchQuery({ queryKey: characterConversationsKey(characterId), queryFn: () => fetchConversations(characterId), staleTime: 0 });
        target = list[0];
      }
      if (!target) {
        target = await createConversationRequest(characterId);
        await qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      }
      await navigate({ to: "/chat/$conversationId", params: { conversationId: target.id } });
    },
    [qc, navigate],
  );
}
