import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCharacter } from "@/store/use-character";
import { CharacterModal } from "@/components/character-modal";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MessageSquarePlus, CheckCircle2, TrendingUp, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/shared/routes";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (s) => s.location.pathname });
  const character = useCharacter((s) => s.getActiveCharacter());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const larryOnlyNav = [
    { title: "Habit Tracker", url: "/habits", icon: CheckCircle2 },
    { title: "Points / Progress", url: "/progress", icon: TrendingUp },
  ];

  const [isDeleting, setIsDeleting] = useState(false);

  const handleNewConversation = async () => {
    try {
      await fetch(`/api/messages/clear?characterId=${encodeURIComponent(character.id)}`, { method: "DELETE" });
      window.location.href = "/";
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/messages/clear?characterId=${encodeURIComponent(character.id)}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
      window.location.href = "/";
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#05050A] text-white relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#05050A] to-[#05050A] pointer-events-none z-0" />
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b ${character.theme.gradient} opacity-[0.03] blur-[100px] pointer-events-none z-0 transition-colors duration-1000`}
        />

        <Sidebar variant="sidebar" className="border-r border-white/5 bg-black/40 backdrop-blur-xl z-20">
          <SidebarContent>
            {/* Conversations section */}
            <SidebarGroup className="pt-4">
              <SidebarGroupLabel className="text-white/40 font-medium tracking-wider text-xs uppercase">
                Conversations
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handleNewConversation}
                      size="lg"
                      className="bg-white/5 hover:bg-white/10 font-medium w-full justify-start"
                      data-testid="button-new-conversation"
                    >
                      <MessageSquarePlus className={character.theme.text} />
                      <span>New Conversation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <div className="group/conv flex items-center w-full">
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/"}
                        className={`flex-1 hover:bg-white/5 hover:text-white ${location === "/" ? "bg-white/10 text-white" : "text-white/60"}`}
                      >
                        <Link to="/">
                          <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${character.theme.gradient} shrink-0`} />
                          <span>{character.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        onClick={handleDeleteConversation}
                        disabled={isDeleting}
                        data-testid="button-delete-conversation"
                        title="Delete conversation"
                        className="opacity-0 group-hover/conv:opacity-100 ml-1 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Larry-only productivity nav */}
            {character.id === "Larry" && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-white/40 font-medium tracking-wider text-xs uppercase">
                  Productivity
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {larryOnlyNav.map((item) => {
                      const isActive = location === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`hover:bg-white/5 hover:text-white ${isActive ? "bg-white/10 text-white" : "text-white/60"}`}
                            data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Link to={item.url}>
                              <item.icon
                                className={`w-4 h-4 ${isActive ? character.theme.text : "opacity-50"}`}
                              />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>

        {/* Main content */}
        <div className="flex flex-col flex-1 relative z-10 h-screen w-full overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 glass-panel rounded-b-none border-t-0 border-x-0 bg-black/20 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger
                className="text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                data-testid="button-sidebar-toggle"
              />
            </div>

            <h1 className="font-display font-bold text-xl tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              {character.name}
            </h1>

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full hover:bg-white/10 transition-all shadow-lg ${character.theme.glow}`}
              onClick={() => setIsModalOpen(true)}
              data-testid="button-open-characters"
            >
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${character.theme.gradient} flex items-center justify-center`}
              >
                <Users className="w-4 h-4 text-white" />
              </div>
            </Button>
          </header>

          <main className="flex-1 overflow-hidden relative flex flex-col">
            {children}
          </main>
        </div>

        <CharacterModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      </div>
    </SidebarProvider>
  );
}
