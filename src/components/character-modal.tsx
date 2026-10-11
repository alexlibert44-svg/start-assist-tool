import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHARACTERS, useCharacter, type CharacterId } from "@/store/use-character";
import { motion } from "framer-motion";
import { useOpenCharacter } from "@/hooks/use-conversations";

interface CharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterModal({ open, onOpenChange }: CharacterModalProps) {
  const { activeCharacterId, setActiveCharacter } = useCharacter();
  const openCharacter = useOpenCharacter();

  // Selecting a guide opens their most recent conversation (or starts one).
  const handleSelect = (id: CharacterId) => {
    setActiveCharacter(id);
    onOpenChange(false);
    void openCharacter(id).catch((e) => console.error("Failed to open conversation:", e));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0f]/95 border-white/10 backdrop-blur-2xl text-white overflow-hidden p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Select Your Guide
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 grid gap-4">
          {(Object.keys(CHARACTERS) as CharacterId[]).map((id, index) => {
            const character = CHARACTERS[id];
            const isActive = activeCharacterId === id;
            
            return (
              <motion.button
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelect(id)}
                className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-300 relative overflow-hidden group ${
                  isActive 
                    ? `bg-white/10 border border-white/20 shadow-lg ${character.theme.glow}` 
                    : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10'
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${character.theme.gradient} opacity-10`} />
                )}
                
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 bg-gradient-to-br ${character.theme.gradient} shadow-lg`}>
                  {character.name.charAt(0)}
                </div>
                
                <div className="flex-1 relative z-10">
                  <h4 className="text-lg font-bold text-white tracking-tight">{character.name}</h4>
                  <p className="text-sm text-white/60 leading-tight mt-0.5">{character.role}</p>
                </div>
                
                {isActive && (
                  <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] relative z-10" />
                )}
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
