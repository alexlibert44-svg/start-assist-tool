import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MoreVertical, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCharacter } from "@/store/use-character";
import { useHabits, useHabitHistory, useStats, useCreateHabit, useUpdateHabit, useDeleteHabit, type HabitCompletion } from "@/hooks/use-habits";
import type { Habit } from "@/shared/schema";
import { addDays, dayName } from "@/shared/plans";

const localToday = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const localDateOf = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const weekStart = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));

function HabitMenu({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label="Habit options" data-testid="button-habit-menu" disabled={disabled} onClick={() => setOpen((value) => !value)}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-9 z-50 min-w-32 border border-border bg-popover p-1 shadow-lg">
            <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => { setOpen(false); onDelete(); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type DisplayItem = {
  key: string;
  name: string;
  kind: "habit" | "task";
  habit: Habit | null;
  completion: HabitCompletion | null;
  completed: boolean;
  dueAt: string | null;
  linkedCharacter: string | null;
  historyOnly: boolean;
};

export default function HabitsPage() {
  const character = useCharacter((store) => store.getActiveCharacter());
  const { data: habits = [], isLoading, error } = useHabits();
  const { data: stats } = useStats();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const today = stats?.today ?? localToday();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const start = weekStart(weekAnchor);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const end = dates[6] ?? start;
  const { data: history = [], isLoading: historyLoading, error: historyError } = useHabitHistory(start, end);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setWeekAnchor(today);
    setSelectedDate(today);
  }, [today]);

  const completionsForDay = useMemo(() => history.filter((item) => item.localDate === selectedDate), [history, selectedDate]);
  const dailyHabits = habits.filter((habit) => habit.kind !== "task" && (!habit.createdAt || localDateOf(habit.createdAt) <= selectedDate));
  const dueTasks = habits.filter((habit) => habit.kind === "task" && habit.dueAt && localDateOf(habit.dueAt) === selectedDate);
  const scheduledIds = new Set([...dailyHabits, ...dueTasks].map((habit) => habit.id));
  const historyOnly = completionsForDay
    .filter((completion) => completion.habitId === null || !scheduledIds.has(completion.habitId))
    .map((completion): DisplayItem => ({
      key: `history-${completion.id}`, name: completion.name, kind: completion.kind === "task" ? "task" : "habit",
      habit: completion.habitId === null ? null : habits.find((habit) => habit.id === completion.habitId) ?? null,
      completion, completed: true, dueAt: null, linkedCharacter: null, historyOnly: true,
    }));
  const displayItems: DisplayItem[] = [
    ...dailyHabits.map((habit): DisplayItem => ({
      key: `habit-${habit.id}`, name: habit.name, kind: "habit", habit, completion: completionsForDay.find((item) => item.habitId === habit.id) ?? null,
      completed: completionsForDay.some((item) => item.habitId === habit.id) || (selectedDate === today && !!habit.completed),
      dueAt: habit.dueAt, linkedCharacter: habit.linkedCharacter, historyOnly: false,
    })),
    ...dueTasks.map((habit): DisplayItem => ({
      key: `task-${habit.id}`, name: habit.name, kind: "task", habit, completion: completionsForDay.find((item) => item.habitId === habit.id) ?? null,
      completed: !!habit.completed, dueAt: habit.dueAt, linkedCharacter: habit.linkedCharacter, historyOnly: false,
    })),
    ...historyOnly,
  ];
  const overdueTasks = selectedDate === today ? habits.filter((habit) => habit.kind === "task" && !habit.completed && habit.dueAt && localDateOf(habit.dueAt) < today) : [];
  const unscheduledTasks = selectedDate === today ? habits.filter((habit) => habit.kind === "task" && !habit.completed && !habit.dueAt) : [];

  const handleAddHabit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newHabitName.trim()) return;
    await createHabit.mutateAsync({ name: newHabitName.trim(), completed: false, streak: 0, kind: "habit" });
    setNewHabitName("");
    setIsAddOpen(false);
  };

  const toggleHabit = async (id: number, currentCompleted: boolean) => {
    if (updatingId === id || deletingId === id) return;
    setUpdatingId(id);
    try { await updateHabit.mutateAsync({ id, completed: !currentCompleted }); }
    finally { setUpdatingId(null); }
  };

  const handleDelete = async (id: number) => {
    if (deletingId === id) return;
    setDeletingId(id);
    try { await deleteHabit.mutateAsync(id); }
    finally { setDeletingId(null); }
  };

  const moveWeek = (amount: number) => {
    const next = addDays(start, amount * 7);
    setWeekAnchor(next);
    setSelectedDate(next);
  };

  const renderItem = (item: DisplayItem, overdue = false) => {
    const id = item.habit?.id ?? null;
    const busy = id !== null && (updatingId === id || deletingId === id);
    const canEdit = selectedDate === today && !item.historyOnly && id !== null;
    return (
      <motion.div key={item.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-b-0" data-testid={`activity-${item.key}`}>
        <div className="flex min-w-0 items-center gap-3">
          {canEdit ? (
            <Checkbox checked={item.completed} disabled={busy} onCheckedChange={() => id !== null && void toggleHabit(id, item.completed)} aria-label={`${item.completed ? "Undo" : "Complete"} ${item.name}`} />
          ) : (
            <span aria-label={item.completed ? "Completed" : "Not completed"} className={`h-4 w-4 shrink-0 rounded-full border ${item.completed ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
          )}
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.historyOnly ? `Saved completion · ${item.completion?.points ?? 0} points${item.habit ? "" : " · item removed"}` : item.kind === "habit" ? "Daily habit" : overdue ? "Overdue task" : "Task"}
              {item.dueAt && ` · ${new Date(item.dueAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
              {item.linkedCharacter && ` · ${item.linkedCharacter}`}
              {item.historyOnly && item.completion?.completedAt && ` · ${new Date(item.completion.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        {canEdit && id !== null && (
          <div className="flex shrink-0 items-center gap-1">
            {item.completed && <span className="hidden text-xs text-muted-foreground sm:inline">Done</span>}
            <HabitMenu onDelete={() => void handleDelete(id)} disabled={busy} />
          </div>
        )}
      </motion.div>
    );
  };

  const completionRate = stats?.dailyCompletionRate ?? null;
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-3xl font-bold text-foreground">Habit Tracker</h2>
            <p className="mt-1 text-sm text-muted-foreground">Daily status and saved completion history.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className={`bg-gradient-to-r ${character.theme.gradient} text-white`} data-testid="button-add-habit"><Plus className="mr-2 h-4 w-4" /> Add Habit</Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border bg-background text-foreground sm:max-w-md">
              <DialogHeader><DialogTitle className="font-display text-xl">Add Daily Habit</DialogTitle></DialogHeader>
              <form onSubmit={handleAddHabit} className="space-y-4 pt-3">
                <input autoFocus className="glass-input w-full rounded-md px-3 py-3 text-foreground" placeholder="e.g., Morning walk" value={newHabitName}
                  onChange={(event) => setNewHabitName(event.target.value)} data-testid="input-habit-name" />
                <Button type="submit" className="w-full" disabled={!newHabitName.trim() || createHabit.isPending} data-testid="button-create-habit">
                  {createHabit.isPending ? "Adding…" : "Add Habit"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <section className="space-y-3" aria-label="Week selector">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => moveWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm font-medium text-foreground">{start} — {end}</p>
            <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => moveWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {dates.map((date) => {
              const count = history.filter((entry) => entry.localDate === date).length;
              return (
                <Button key={date} variant={selectedDate === date ? "secondary" : "ghost"} className={`h-auto min-w-0 flex-col gap-1 px-1 py-2 ${selectedDate === date ? character.theme.text : "text-muted-foreground"}`}
                  aria-pressed={selectedDate === date} aria-label={`${dayName(date)}, ${date}${date === today ? ", today" : ""}`} onClick={() => setSelectedDate(date)}>
                  <span className="text-[11px]">{date === today ? "Today" : dayName(date).slice(0, 3)}</span>
                  <span className="text-xs">{date.slice(8)}</span>
                  <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" style={{ opacity: count ? 1 : 0 }} />
                </Button>
              );
            })}
          </div>
        </section>

        {historyError && <p role="status" className="text-sm text-destructive">Completion history could not be loaded. Today's saved status remains available.</p>}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0" aria-label={`${selectedDate} activities`}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-semibold text-foreground">{selectedDate === today ? "Today" : `${dayName(selectedDate)} · ${selectedDate}`}</h3>
              {selectedDate === today && stats && <span className="text-xs text-muted-foreground">{stats.completedToday}/{stats.dueToday} completed</span>}
              {selectedDate !== today && <span className="text-xs text-muted-foreground">{completionsForDay.length} saved completions</span>}
            </div>
            {isLoading || historyLoading ? <p className="py-8 text-sm text-muted-foreground">Loading your schedule…</p> : error ?
              <p role="alert" className="py-8 text-sm text-destructive">Could not load your activities.</p> : displayItems.length ?
                <div className="divide-y divide-border/40">{displayItems.map((item) => renderItem(item))}</div> :
                <div className="py-8 text-sm text-muted-foreground">Nothing scheduled or completed on this day.</div>}

            {!!overdueTasks.length && <div className="mt-6"><h4 className="mb-1 text-xs font-semibold uppercase text-destructive">Overdue tasks</h4>{overdueTasks.map((habit) => renderItem({
              key: `overdue-${habit.id}`, name: habit.name, kind: "task", habit, completion: null, completed: false, dueAt: habit.dueAt, linkedCharacter: habit.linkedCharacter, historyOnly: false,
            }, true))}</div>}
            {!!unscheduledTasks.length && <div className="mt-6"><h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Unscheduled tasks</h4>{unscheduledTasks.map((habit) => renderItem({
              key: `unscheduled-${habit.id}`, name: habit.name, kind: "task", habit, completion: null, completed: false, dueAt: null, linkedCharacter: habit.linkedCharacter, historyOnly: false,
            }))}</div>}
          </section>

          <aside className="space-y-4">
            <section className="border-t border-border pt-4">
              <div className="mb-3 flex items-center gap-2 text-muted-foreground"><Target className="h-4 w-4" /><h3 className="text-xs font-semibold uppercase">Today's completion rate</h3></div>
              {completionRate === null ? <p className="text-sm text-muted-foreground">No activities scheduled today</p> : <>
                <p className={`font-display text-4xl font-bold ${character.theme.text}`}>{completionRate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">{stats?.completedToday}/{stats?.dueToday} scheduled today</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><motion.div key={completionRate} initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} className={`h-full bg-gradient-to-r ${character.theme.gradient}`} /></div>
              </>}
            </section>
            <section className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">History</h3>
              <p className="mt-2 text-sm text-foreground">{completionsForDay.length} saved completion{completionsForDay.length === 1 ? "" : "s"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Past days are read-only; records stay available after habits are removed.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}