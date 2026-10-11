import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Target, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCharacter } from "@/store/use-character";
import { useHabits, useStats, useCreateHabit, useUpdateHabit, useDeleteHabit } from "@/hooks/use-habits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Small inline dropdown menu
function HabitMenu({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={disabled}
        data-testid="button-habit-menu"
        className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
        aria-label="Habit options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-8 z-50 min-w-[120px] glass-panel border border-white/10 rounded-xl overflow-hidden bg-[#0e0e18]/95 shadow-xl"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              data-testid="button-delete-habit"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HabitsPage() {
  const character = useCharacter((s) => s.getActiveCharacter());
  const { data: habits = [], isLoading } = useHabits();
  const { data: stats } = useStats();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    await createHabit.mutateAsync({ name: newHabitName.trim(), completed: false, streak: 0, kind: "habit" });
    setNewHabitName("");
    setIsAddOpen(false);
  };

  const toggleHabit = async (id: number, currentCompleted: boolean) => {
    if (updatingId === id || deletingId === id) return;
    setUpdatingId(id);
    try {
      await updateHabit.mutateAsync({ id, completed: !currentCompleted });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (deletingId === id) return;
    setDeletingId(id);
    try {
      await deleteHabit.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  const completionRate = stats?.dailyCompletionRate ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-1">Habit Tracker</h2>
          <p className="text-white/50 text-sm">Daily habits reset at the start of each new day.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-add-habit"
              className={`bg-gradient-to-r ${character.theme.gradient} text-white shadow-lg ${character.theme.glow} hover:opacity-90 font-medium rounded-xl`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 bg-[#0a0a0f]/95 text-white sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Add New Habit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddHabit} className="space-y-4 pt-4">
              <input
                autoFocus
                className="w-full glass-input rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                placeholder="E.g., Morning run"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                data-testid="input-habit-name"
              />
              <Button
                type="submit"
                disabled={!newHabitName.trim() || createHabit.isPending}
                className={`w-full bg-gradient-to-r ${character.theme.gradient} text-white`}
                data-testid="button-create-habit"
              >
                {createHabit.isPending ? "Adding..." : "Add Habit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Habit list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[66px] rounded-2xl glass-panel animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && habits.length === 0 && (
            <div className="text-center p-12 glass-panel rounded-3xl">
              <Target className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 mb-2">No habits yet.</p>
              <p className="text-white/30 text-sm">Add your first habit to start building discipline.</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {!isLoading && habits.map((habit, i) => {
              const isBusy = updatingId === habit.id || deletingId === habit.id;
              const isDeleting = deletingId === habit.id;
              const isDone = !!habit.completed;

              return (
                <motion.div
                  key={habit.id}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: isDeleting ? 0.4 : 1, x: 0 }}
                  exit={{ opacity: 0, x: 18, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => !isBusy && toggleHabit(habit.id, isDone)}
                  className={`flex items-center justify-between p-4 rounded-2xl glass-panel transition-all duration-200 select-none border ${
                    isDone ? "border-white/10" : "border-white/5"
                  } ${isBusy ? "opacity-60 cursor-wait" : "hover:bg-white/[0.04] cursor-pointer"}`}
                  data-testid={`card-habit-${habit.id}`}
                >
                  {/* Left: checkbox + name */}
                  <div className="flex items-center gap-4 min-w-0">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => !isBusy && toggleHabit(habit.id, isDone)}
                      disabled={isBusy}
                      data-testid={`checkbox-habit-${habit.id}`}
                      className={`w-6 h-6 rounded-md border-white/30 shrink-0 ${
                        isDone ? `bg-gradient-to-br ${character.theme.gradient} border-transparent` : ""
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0">
                      <span
                        className={`text-[15px] transition-colors duration-200 block truncate ${
                          isDone ? "text-white/40 line-through" : "text-white/85"
                        }`}
                      >
                        {habit.name}
                      </span>
                      {(
                        <p className="text-xs text-white/40 mt-0.5 truncate">
                          {habit.kind === "task" ? "Task" : "Daily habit"}
                          {(habit.dueAt || habit.linkedCharacter) && " · "}
                          {habit.dueAt && new Date(habit.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          {habit.dueAt && habit.linkedCharacter && " · "}
                          {habit.linkedCharacter && `Auto-completes with ${habit.linkedCharacter}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: done tag + three-dots menu */}
                  <div
                    className="flex items-center gap-2 shrink-0 ml-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isDone && (
                      <span className="text-xs text-white/30 font-medium hidden sm:block">Done</span>
                    )}
                    <HabitMenu
                      onDelete={() => handleDelete(habit.id)}
                      disabled={isBusy}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Stats panel */}
        <div className="space-y-4">
          {/* Completion rate */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-3xl relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${character.theme.gradient} opacity-15 blur-3xl rounded-full`} />
            <h3 className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Daily Completion Rate</h3>
            {completionRate === null ? (
              <p className="text-white/50 text-sm" data-testid="text-completion-rate">No activities scheduled today</p>
            ) : (
            <div className="flex items-end gap-2 mb-1">
              <span className={`text-5xl font-display font-bold ${character.theme.text}`} data-testid="text-completion-rate">
                {completionRate}%
              </span>
              <span className="text-white/30 mb-1 text-sm">{stats?.completedToday}/{stats?.dueToday} today</span>
            </div>
            )}
            <div className="w-full bg-white/5 h-2 rounded-full mt-3 overflow-hidden">
              <motion.div
                key={completionRate}
                initial={{ width: 0 }}
                animate={{ width: `${completionRate ?? 0}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${character.theme.gradient} rounded-full`}
              />
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
