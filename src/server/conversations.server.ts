// Persistence adapter for conversations. CURRENT backend: the Lovable Cloud database, via the
// server-side admin client (single-user app, no sign-in, RLS locked to the server).
// To move to a user-owned Supabase project, replace `cloudRepository` with an implementation of
// ConversationRepository that uses a per-request, user-authenticated client (see docs/SUPABASE_SETUP.md).
import {
  DEFAULT_CONVERSATION_TITLE,
  type Conversation,
  type ConversationCharacter,
  type ConversationMessage,
  type ConversationRepository,
  type OwnerScope,
} from "@/shared/conversations";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ConvRow = {
  id: string; user_id: string | null; title: string; character_id: string;
  metadata: unknown; created_at: string; updated_at: string;
};
type MsgRow = {
  id: number; conversation_id: string | null; sender: string; content: string;
  metadata: unknown; created_at: string | null;
};

const toConv = (r: ConvRow): Conversation => ({
  id: r.id, userId: r.user_id, title: r.title, characterId: r.character_id as ConversationCharacter,
  metadata: (r.metadata as Record<string, unknown>) ?? {}, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toMsg = (r: MsgRow): ConversationMessage => ({
  id: r.id, conversationId: r.conversation_id ?? "", sender: r.sender, content: r.content,
  metadata: (r.metadata as Record<string, unknown>) ?? {}, createdAt: r.created_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Ownership filter: in single-user mode rows have user_id NULL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function owned<Q extends { is: any; eq: any }>(q: Q, scope: OwnerScope): Q {
  return scope.userId ? q.eq("user_id", scope.userId) : q.is("user_id", null);
}

export const cloudRepository: ConversationRepository = {
  async createConversation(scope, input) {
    const c = await db();
    const row = check(await c.from("conversations").insert({
      user_id: scope.userId, character_id: input.characterId,
      title: input.title?.trim() || DEFAULT_CONVERSATION_TITLE, metadata: (input.metadata ?? {}) as never,
    }).select().single());
    return toConv(row as ConvRow);
  },
  async listConversations(scope, filter) {
    const c = await db();
    let q = owned(c.from("conversations").select("*"), scope).order("updated_at", { ascending: false });
    if (filter?.characterId) q = q.eq("character_id", filter.characterId);
    if (filter?.limit) q = q.limit(filter.limit);
    return (check(await q) as ConvRow[]).map(toConv);
  },
  async getConversation(scope, id) {
    const c = await db();
    const rows = check(await owned(c.from("conversations").select("*").eq("id", id), scope)) as ConvRow[];
    return rows[0] ? toConv(rows[0]) : undefined;
  },
  async updateConversationTitle(scope, id, title) {
    const c = await db();
    const rows = check(await owned(c.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", id), scope).select()) as ConvRow[];
    return rows[0] ? toConv(rows[0]) : undefined;
  },
  async updateConversationMetadata(scope, id, metadata) {
    const existing = await cloudRepository.getConversation(scope, id);
    if (!existing) return undefined;
    const c = await db();
    const rows = check(await owned(c.from("conversations").update({ metadata: { ...existing.metadata, ...metadata } as never }).eq("id", id), scope).select()) as ConvRow[];
    return rows[0] ? toConv(rows[0]) : undefined;
  },
  async deleteConversation(scope, id) {
    const c = await db();
    // Messages are removed by ON DELETE CASCADE.
    const rows = check(await owned(c.from("conversations").delete().eq("id", id), scope).select()) as ConvRow[];
    return rows.length > 0;
  },
  async getMessages(scope, conversationId) {
    if (!(await cloudRepository.getConversation(scope, conversationId))) return [];
    const c = await db();
    return (check(await c.from("messages").select("*").eq("conversation_id", conversationId).order("id")) as MsgRow[]).map(toMsg);
  },
  async addMessage(scope, conversationId, input) {
    const conv = await cloudRepository.getConversation(scope, conversationId);
    if (!conv) throw new Error("Conversation not found");
    const c = await db();
    const row = check(await c.from("messages").insert({
      conversation_id: conversationId, character_id: conv.characterId, sender: input.sender,
      content: input.content, metadata: (input.metadata ?? {}) as never,
    }).select().single());
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Auto-title from the first user message while the title is still the default.
    if (input.sender === "user" && conv.title === DEFAULT_CONVERSATION_TITLE) {
      const t = input.content.replace(/\s+/g, " ").trim();
      patch["title"] = t.length > 48 ? `${t.slice(0, 45)}...` : t;
    }
    check(await c.from("conversations").update(patch).eq("id", conversationId).select());
    return toMsg(row as MsgRow);
  },
  async clearMessages(scope, conversationId) {
    if (!(await cloudRepository.getConversation(scope, conversationId))) throw new Error("Conversation not found");
    const c = await db();
    check(await c.from("messages").delete().eq("conversation_id", conversationId));
  },
};

/** The active repository. Swap this export to change the persistence backend. */
export const conversations: ConversationRepository = cloudRepository;

/** Owner of the current request. No sign-in exists yet, so everything is single-user. */
export function ownerFromRequest(_request: Request): OwnerScope {
  return { userId: null };
}
