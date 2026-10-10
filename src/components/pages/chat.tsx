import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { useCharacter, WELCOME_MESSAGES } from "@/store/use-character";
import { useMessages, useCreateMessage } from "@/hooks/use-messages";
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

export default function ChatPage() {
  const character = useCharacter((s) => s.getActiveCharacter());
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);
  const { data: serverMessages } = useMessages();
  const createMessage = useCreateMessage();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Local message list — the single source of truth for display
  const [chatMessages, setChatMessages] = useState<LocalMessage[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Seed from server once when data first arrives
  useEffect(() => {
    if (!initialized && serverMessages !== undefined) {
      if (serverMessages.length > 0) {
        setChatMessages(serverMessages as LocalMessage[]);
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
    }
  }, [serverMessages, initialized, character.id]);

  // When character changes, reset and re-seed
  useEffect(() => {
    setInitialized(false);
    setChatMessages([]);
    setIsAiTyping(false);
  }, [activeCharacterId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiTyping]);

  const handleClearChat = async () => {
    setIsClearing(true);
    try {
      await fetch(
        `/api/messages/clear?characterId=${encodeURIComponent(character.id)}`,
        { method: "DELETE" }
      );
      // Invalidate server cache
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
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
    createMessage.mutate({
      content: userText,
      sender: "user",
      characterId: character.id,
    });

    let reply = "I'm here. How can I help?";

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
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
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
      createMessage.mutate({
        content: reply,
        sender: character.id,
        characterId: character.id,
      });
    } finally {
      setIsAiTyping(false);
    }
  };

  // Show the clear button only when there are real messages (not just the welcome placeholder)
  const hasMessages = chatMessages.some((m) => m.id !== 0);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative px-4">
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
                  <p className="text-[15px] sm:text-base">{msg.content}</p>
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
