import { motion } from "framer-motion";
import { Trophy, Target, Shield, Flame } from "lucide-react";
import { useCharacter } from "@/store/use-character";
import { useProfile } from "@/hooks/use-profile";
import { useHabits } from "@/hooks/use-habits";

const LEVEL_MINS = [0, 100, 300, 600];
const MAX_LEVEL = 4;

function calcLevel(score: number): number {
  if (score >= 600) return 4;
  if (score >= 300) return 3;
  if (score >= 100) return 2;
  return 1;
}

export default function ProgressPage() {
  const character = useCharacter((s) => s.getActiveCharacter());
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: habits = [], isLoading: habitsLoading } = useHabits();

  const isLoading = profileLoading || habitsLoading;

  const score = profile?.xp ?? 0;
  const level = calcLevel(score);

  const completedHabits = habits.filter((h) => h.completed).length;
  const totalHabits = habits.length;

  // Primary progress: habit completion rate — updates in real-time on every toggle
  const completionPercent =
    totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

  const bestStreak =
    habits.length > 0 ? Math.max(...habits.map((h) => h.streak ?? 0)) : 0;

  const nextLevelMin = level < MAX_LEVEL ? LEVEL_MINS[level] : null;
  const toNextLevel = nextLevelMin !== null ? nextLevelMin - score : 0;

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-3xl glass-panel animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-display font-bold text-white mb-2">Progress</h2>
        <p className="text-white/50 text-sm">
          Complete habits to build your Discipline Score.
        </p>
      </div>

      {/* Main progress card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-7 md:p-10 mb-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 border-white/10"
      >
        <div
          className={`absolute -right-16 -top-16 w-64 h-64 bg-gradient-to-br ${character.theme.gradient} opacity-20 blur-[100px] rounded-full pointer-events-none`}
        />

        {/* Circle — habit completion % */}
        <div className="relative shrink-0">
          <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative">
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50" cy="50" r="46"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <motion.circle
                key={completionPercent}
                initial={{ strokeDasharray: "0, 300" }}
                animate={{
                  strokeDasharray: `${(completionPercent / 100) * 289}, 300`,
                }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                cx="50" cy="50" r="46"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                className={character.theme.text}
              />
            </svg>
            <div className="text-center z-10">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest block">
                Today
              </span>
              <span
                className="text-3xl font-display font-bold text-white"
                data-testid="text-completion-percent"
              >
                {completionPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar + labels */}
        <div className="flex-1 w-full text-center md:text-left">
          <p className="text-white/80 text-base font-semibold mb-1">
            {completedHabits} of {totalHabits} habits completed
          </p>
          <p className="text-white/40 text-sm mb-5">
            {totalHabits - completedHabits > 0
              ? `${totalHabits - completedHabits} remaining today`
              : "All done for today"}
          </p>

          {/* Habit completion bar */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-white/40">
              <span>0%</span>
              <span className="font-bold text-white/70">{completionPercent}%</span>
              <span>100%</span>
            </div>
            <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
              <motion.div
                key={completionPercent}
                initial={{ width: 0 }}
                animate={{ width: `${completionPercent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${character.theme.gradient} rounded-full`}
              />
            </div>
          </div>

          {/* Discipline Score inline */}
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
              <Shield className={`w-4 h-4 ${character.theme.text}`} />
              <span className="text-sm font-bold text-white" data-testid="text-score">
                {score} pts
              </span>
              <span className="text-white/30 text-xs">Discipline Score</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
              <span className="text-sm font-bold text-white" data-testid="text-level">
                Level {level}
              </span>
              {level < MAX_LEVEL && (
                <span className="text-white/30 text-xs">
                  · {toNextLevel} pts to Level {level + 1}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Habits Done",
            value: `${completedHabits}/${totalHabits}`,
            sub: `${completionPercent}% complete`,
            icon: Target,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
          },
          {
            label: "Best Streak",
            value: `${bestStreak}`,
            sub: "days in a row",
            icon: Flame,
            color: "text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            label: "Discipline Score",
            value: score.toLocaleString(),
            sub: `Level ${level} of ${MAX_LEVEL}`,
            icon: Shield,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="glass-panel p-5 rounded-3xl hover:bg-white/[0.04] transition-colors"
            data-testid={`card-stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div
              className={`w-10 h-10 rounded-2xl ${card.bg} flex items-center justify-center mb-3`}
            >
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider mb-0.5">
              {card.label}
            </p>
            <h4 className="text-2xl font-display font-bold text-white">{card.value}</h4>
            <p className="text-white/30 text-xs mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Habit breakdown */}
      {habits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-panel rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white/80 uppercase tracking-wider text-sm">
              Habit Breakdown
            </h3>
            <span className={`text-sm font-bold ${character.theme.text}`}>
              {completionPercent}% today
            </span>
          </div>
          <div className="space-y-3">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between gap-4"
                data-testid={`habit-row-${habit.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      habit.completed
                        ? `bg-gradient-to-br ${character.theme.gradient}`
                        : "bg-white/20"
                    }`}
                  />
                  <span
                    className={`text-sm truncate ${
                      habit.completed ? "text-white" : "text-white/50"
                    }`}
                  >
                    {habit.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      habit.completed
                        ? "bg-white/10 text-white/70"
                        : "bg-white/5 text-white/30"
                    }`}
                  >
                    {habit.completed ? "+10 pts" : "Pending"}
                  </span>
                  {(habit.streak ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-orange-400 text-xs">
                      <Flame className="w-3 h-3" />
                      <span className="font-bold">{habit.streak}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
