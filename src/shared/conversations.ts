// Conversation data model shared by client, API routes and the persistence adapter.
// This file is the integration boundary: any persistence backend (the current Lovable Cloud
// database, or a user-owned Supabase project) must implement ConversationRepository.

export type ConversationCharacter = "Larry" | "Sensei" | "Dr Neo" | "Hassan";

export interface Conversation {
  id: string; // stable UUID
  userId: string | null; // owner; null while the app has no sign-in
  title: string;
  characterId: ConversationCharacter;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: string;
  sender: string; // "user" or the character id (role)
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

export const DEFAULT_CONVERSATION_TITLE = "New conversation";

/** Owner scope passed to every repository call. userId null = single-user mode (no sign-in). */
export interface OwnerScope {
  userId: string | null;
}

export interface ConversationRepository {
  createConversation(scope: OwnerScope, input: { characterId: ConversationCharacter; title?: string; metadata?: Record<string, unknown> }): Promise<Conversation>;
  listConversations(scope: OwnerScope, filter?: { characterId?: ConversationCharacter; limit?: number }): Promise<Conversation[]>;
  getConversation(scope: OwnerScope, id: string): Promise<Conversation | undefined>;
  updateConversationTitle(scope: OwnerScope, id: string, title: string): Promise<Conversation | undefined>;
  updateConversationMetadata(scope: OwnerScope, id: string, metadata: Record<string, unknown>): Promise<Conversation | undefined>;
  deleteConversation(scope: OwnerScope, id: string): Promise<boolean>;
  getMessages(scope: OwnerScope, conversationId: string): Promise<ConversationMessage[]>;
  addMessage(scope: OwnerScope, conversationId: string, input: { sender: string; content: string; metadata?: Record<string, unknown> }): Promise<ConversationMessage>;
  clearMessages(scope: OwnerScope, conversationId: string): Promise<void>;
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
