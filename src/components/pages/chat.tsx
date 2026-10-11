import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { useCharacter, WELCOME_MESSAGES, CHARACTERS } from "@/store/use-character";
import { useConversation, addMessageRequest, CONVERSATIONS_KEY, conversationKey } from "@/hooks/use-conversations";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/shared/routes";

type LocalMessage = {
  id: number;
  content: string;
  sender: string;
  characterId: string;
  createdAt: Date | string;
};

export default function ChatPage({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const { data: convData, error: convError } = useConversation(conversationId);
  const setActiveCharacter = useCharacter((s) => s.setActiveCharacter);
  const storeCharacter = useCharacter((s) => s.getActiveCharacter());
  // The conversation's own character is authoritative once loaded.
  const character = convData ? CHARACTERS[convData.conversation.characterId] : storeCharacter;
  const serverMessages = convData?.messages;
  const pendingHandoff = useCharacter((s) => s.pendingHandoff);
  const doHandoff = useCharacter((s) => s.handoff);
  const clearHandoff = useCharacter((s) => s.clearHandoff);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Local message list — the single source of truth for display
  const [chatMessages, setChatMessages] = useState<LocalMessage[]>([]);
  const [initialized, setInitialized] = useState(false);
  const seededFor = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed from server once when data first arrives
  useEffect(() => {
    if (!initialized && serverMessages !== undefined) {
      if (serverMessages.length > 0) {
        setChatMessages(serverMessages.map((m) => ({ ...m, characterId: character.id, createdAt: m.createdAt ?? new Date() })));
      } else {
        setChatMessages([
          {
            id: 0,
            content: WELCOME_MESSAGES[character.id],
            sender: character.id,
            characterId: character.id,
            createdAt: new Date(),
          },
        ]);
      }
      setInitialized(true);
      seededFor.current = conversationId;
    }
  }, [serverMessages, initialized, character.id, conversationId]);

  // Restore the character assigned to this conversation (header, theme, sidebar).
  useEffect(() => {
    if (convData) setActiveCharacter(convData.conversation.characterId);
  }, [convData, setActiveCharacter]);

  const persist = (sender: string, content: string) =>
    addMessageRequest(conversationId, sender, content)
      .then(() => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }))
      .catch((err) => {
        console.error("Failed to save message:", err);
        setSaveError("Some messages could not be saved. They may be missing after a refresh.");
      });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiTyping]);

  const handleClearChat = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Clear failed (${res.status})`);
      queryClient.invalidateQueries({ queryKey: conversationKey(conversationId) });
      // Reset local state to welcome message
      setChatMessages([
        {
          id: 0,
          content: WELCOME_MESSAGES[character.id],
          sender: character.id,
          characterId: character.id,
          createdAt: new Date(),
        },
      ]);
      setInitialized(true);
    } catch (err) {
      console.error("Failed to clear chat:", err);
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || isAiTyping) return;
    setInput("");
    await sendText(userText);
  };

  // Auto-send a request handed over from another character once this chat is loaded
  useEffect(() => {
    if (initialized && seededFor.current === conversationId && pendingHandoff && pendingHandoff.conversationId === conversationId && !isAiTyping) {
      const h = pendingHandoff;
      clearHandoff();
      void sendText(h.question, h.from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, pendingHandoff, conversationId]);

  const sendText = async (userText: string, handoffFrom?: string) => {
    setIsAiTyping(true);

    // 1. Add user message immediately — never disappears
    const userMsg: LocalMessage = {
      id: Date.now(),
      content: userText,
      sender: "user",
      characterId: character.id,
      createdAt: new Date(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    // 2. History from current local state — exclude the local welcome placeholder (id: 0)
    const historyForAI = chatMessages
      .filter((m) => m.id !== 0)
      .slice(-16)
      .map((m) => ({ sender: m.sender, content: m.content }));

    // 3. Save user message to server in the background (don't block display)
    void persist("user", userText);

    let reply = "I'm here. How can I help?";
    let handoffTarget: { character: string; question: string; conversationId: string } | null = null;

    try {
      // 4. Call AI with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            character: character.id,
            characterId: character.id,
            history: historyForAI,
            conversationId,
            handoffFrom,
            clientNow: new Date().toString(),
            tzOffsetMinutes: new Date().getTimezoneOffset(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.dataChanged) {
            queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
            queryClient.invalidateQueries({ queryKey: [api.profile.get.path] });
          }
          if (data.handoff?.character && data.handoff?.question && data.handoff?.conversationId) handoffTarget = data.handoff;
          if (data.reply && typeof data.reply === "string" && data.reply.trim()) {
            reply = data.reply;
          } else {
            console.error("Empty or invalid reply from AI:", data);
          }
        } else {
          const errBody = await response.text().catch(() => "");
          console.error("AI chat HTTP error:", response.status, errBody);
          reply = "Something went wrong. Please try again.";
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === "AbortError") {
          reply = "Response timed out. Please try again.";
        } else {
          console.error("AI fetch error:", err);
          reply = "Connection error. Please try again.";
        }
      }

      // 5. Add AI reply immediately — never disappears
      const aiMsg: LocalMessage = {
        id: Date.now() + 1,
        content: reply,
        sender: character.id,
        characterId: character.id,
        createdAt: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);

      // 6. Save AI reply to server in the background
      void persist(character.id, reply);
    } finally {
      setIsAiTyping(false);
    }
    if (handoffTarget) {
      const target = handoffTarget;
      setTimeout(() => {
        doHandoff(character.id, target.character as typeof character.id, target.question, target.conversationId);
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        void navigate({ to: "/chat/$conversationId", params: { conversationId: target.conversationId } });
      }, 700);
    }
  };

  // Show the clear button only when there are real messages (not just the welcome placeholder)
  const hasMessages = chatMessages.some((m) => m.id !== 0);

  if (convError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
        <p>This conversation could not be found. It may have been deleted.</p>
        <Button variant="ghost" className="text-white/70 hover:bg-white/10" onClick={() => navigate({ to: "/" })}>
          Open my conversations
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative px-4">
      {saveError && (
        <div className="absolute top-3 left-4 z-20 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          {saveError}
        </div>
      )}
      {/* Clear Chat Button — top right, only when there are messages */}
      <AnimatePresence>
        {hasMessages && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-3 right-4 z-20"
          >
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-clear-chat"
              onClick={() => setShowClearDialog(true)}
              className="text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl gap-1.5 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Chat
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-32 pt-8 space-y-6 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                {!isUser && (
                  <span
                    className={`text-xs font-semibold mb-1 ml-1 tracking-wider ${character.theme.text} opacity-80 uppercase`}
                  >
                    {character.name}
                  </span>
                )}
                <div
                  className={`p-4 rounded-2xl shadow-lg leading-relaxed ${
                    isUser
                      ? "bg-white/10 backdrop-blur-md border border-white/5 text-white rounded-tr-sm"
                      : `${character.theme.chatBubble} text-white rounded-tl-sm shadow-xl ${character.theme.glow} border ${character.theme.border}`
                  }`}
                >
                  <p className="text-[15px] sm:text-base whitespace-pre-line">{msg.content.replace(/\*\*/g, "")}</p>
                </div>
              </motion.div>
            );
          })}

          {isAiTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col max-w-[80%] mr-auto items-start"
            >
              <span
                className={`text-xs font-semibold mb-1 ml-1 tracking-wider ${character.theme.text} opacity-80 uppercase`}
              >
                {character.name}
              </span>
              <div
                className={`p-4 rounded-2xl rounded-tl-sm ${character.theme.chatBubble} shadow-xl ${character.theme.glow}`}
              >
                <div className="flex space-x-1.5 items-center h-5">
                  <div className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#05050A] via-[#05050A]/90 to-transparent pt-12">
        <div className="max-w-4xl mx-auto relative group">
          <div
            className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${character.theme.gradient} opacity-20 group-focus-within:opacity-40 blur-md transition duration-500`}
          />
          <form
            onSubmit={handleSend}
            className="relative flex items-center glass-panel rounded-2xl overflow-hidden bg-black/40 border-white/10"
          >
            <div className="pl-4 pr-2">
              <Sparkles className={`w-5 h-5 ${character.theme.text} opacity-50`} />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                character.id === "Larry"
                  ? "Ask Larry or the team..."
                  : `Ask ${character.name}...`
              }
              className="flex-1 bg-transparent text-white placeholder:text-white/30 px-2 py-4 focus:outline-none text-[15px]"
              disabled={isAiTyping}
              data-testid="input-message"
            />
            <div className="pr-2 pl-1">
              <Button
                type="submit"
                disabled={!input.trim() || isAiTyping}
                size="icon"
                data-testid="button-send"
                className={`rounded-xl transition-all duration-300 ${
                  input.trim() && !isAiTyping
                    ? `bg-gradient-to-r ${character.theme.gradient} text-white shadow-lg ${character.theme.glow} hover:scale-105`
                    : "bg-white/5 text-white/30"
                }`}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Clear Chat Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="glass-panel border-white/10 bg-[#0a0a0f]/95 text-white sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Clear this conversation?
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm py-2">
            All messages with <span className="text-white font-medium">{character.name}</span> will be permanently deleted. This cannot be undone.
          </p>
          <DialogFooter className="gap-2 flex-row justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowClearDialog(false)}
              disabled={isClearing}
              className="text-white/50 hover:text-white hover:bg-white/10"
              data-testid="button-cancel-clear"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClearChat}
              disabled={isClearing}
              data-testid="button-confirm-clear"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50"
            >
              {isClearing ? "Clearing..." : "Delete Messages"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
