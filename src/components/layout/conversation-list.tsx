import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useCharacterConversations, useDeleteConversation, useRenameConversation } from "@/hooks/use-conversations";
import { CHARACTERS } from "@/store/use-character";
import type { Conversation, ConversationCharacter } from "@/shared/conversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COLLAPSED_COUNT = 5;

export function ConversationList({ activePath, characterId }: { activePath: string; characterId: ConversationCharacter }) {
  const { data: list, isLoading, error } = useCharacterConversations(characterId);
  const rename = useRenameConversation();
  const remove = useDeleteConversation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Collapse again when switching to another character's list.
  useEffect(() => setExpanded(false), [characterId]);

  const all = list ?? [];
  const shown = expanded ? all : all.slice(0, COLLAPSED_COUNT);

  const submitRename = async () => {
    if (!renaming || !title.trim()) return;
    setActionError(null);
    try {
      await rename.mutateAsync({ id: renaming.id, title: title.trim() });
      setRenaming(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setActionError(null);
    const id = deleting.id;
    try {
      await remove.mutateAsync(id);
      setDeleting(null);
      if (activePath === `/chat/${id}`) void navigate({ to: "/" });
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <div className="min-h-0 flex flex-col mt-1">
      <div className="min-h-0 max-h-[50vh] overflow-y-auto pr-1" data-testid="conversation-list">
        {isLoading && <p className="px-2 py-2 text-xs text-white/30">Loading...</p>}
        {error && <p className="px-2 py-2 text-xs text-red-300">Could not load conversations.</p>}
        {shown.map((c) => {
          const ch = CHARACTERS[c.characterId];
          if (!ch) return null;
          const active = activePath === `/chat/${c.id}`;
          return (
            <div
              key={c.id}
              className={`group/conv flex items-center rounded-md ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
            >
              <Link
                to="/chat/$conversationId"
                params={{ conversationId: c.id }}
                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-sm"
                data-testid={`conversation-${c.id}`}
              >
                <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${ch.theme.gradient} shrink-0`} />
                <span className="truncate">{c.title}</span>
                <span className={`ml-auto shrink-0 text-[10px] uppercase tracking-wider ${ch.theme.text} opacity-70`}>{ch.name}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Options for ${c.title}`}
                    data-testid={`conversation-menu-${c.id}`}
                    className="p-1.5 mr-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 md:opacity-0 md:group-hover/conv:opacity-100 data-[state=open]:opacity-100 transition-opacity shrink-0"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#0a0a0f]/95 border-white/10 text-white">
                  <DropdownMenuItem onSelect={() => { setActionError(null); setTitle(c.title); setRenaming(c); }}>
                    <Pencil className="w-4 h-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400 focus:text-red-400" onSelect={() => { setActionError(null); setDeleting(c); }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      {all.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          type="button"
          className="mt-1 px-2 py-1.5 text-xs text-white/40 hover:text-white text-left shrink-0"
          data-testid="button-toggle-conversations"
        >
          {expanded ? "Show Less" : `Show All (${all.length})`}
        </button>
      )}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="glass-panel border-white/10 bg-[#0a0a0f]/95 text-white sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Rename conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); void submitRename(); }}>
            <input
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-white/30"
              data-testid="input-rename"
            />
            {actionError && <p className="text-xs text-red-300 mt-2">{actionError}</p>}
            <DialogFooter className="gap-2 flex-row justify-end pt-4">
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)} className="text-white/50 hover:text-white hover:bg-white/10">Cancel</Button>
              <Button type="submit" disabled={!title.trim() || rename.isPending} className="bg-white/10 hover:bg-white/20 text-white" data-testid="button-save-rename">
                {rename.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="glass-panel border-white/10 bg-[#0a0a0f]/95 text-white sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" /> Delete this conversation?
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm py-2">
            "<span className="text-white font-medium">{deleting?.title}</span>" and its messages will be permanently deleted. Other conversations are not affected.
          </p>
          {actionError && <p className="text-xs text-red-300">{actionError}</p>}
          <DialogFooter className="gap-2 flex-row justify-end pt-2">
            <Button variant="ghost" onClick={() => setDeleting(null)} className="text-white/50 hover:text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={() => void confirmDelete()} disabled={remove.isPending} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30" data-testid="button-confirm-delete">
              {remove.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
