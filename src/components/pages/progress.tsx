import { motion } from "framer-motion";
import { Target, Shield, CalendarCheck } from "lucide-react";
import { useCharacter } from "@/store/use-character";
import { useStats } from "@/hooks/use-habits";

export default function ProgressPage() {
  const character = useCharacter((s) => s.getActiveCharacter());
  const { data: stats, isLoading, error } = useStats();

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

  if (error || !stats) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <p className="text-red-300 text-sm">Could not load your progress. Please try again.</p>
      </div>
    );
  }

  const score = stats.points;
  const rate = stats.dailyCompletionRate;
  const days = stats.consecutiveDays;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-display font-bold text-white mb-2">Progress</h2>
        <p className="text-white/50 text-sm">
          Every completed task or daily habit earns 5 points.
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

        <div className="relative shrink-0">
          <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <motion.circle
                key={rate ?? -1}
                initial={{ strokeDasharray: "0, 300" }}
                animate={{ strokeDasharray: `${((rate ?? 0) / 100) * 289}, 300` }}
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
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest block">Today</span>
              <span className="text-3xl font-display font-bold text-white" data-testid="text-completion-percent">
                {rate === null ? "—" : `${rate}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full text-center md:text-left">
          <p className="text-white/80 text-base font-semibold mb-1">
            {rate === null
              ? "No activities scheduled today"
              : `${stats.completedToday} of ${stats.dueToday} completed today`}
          </p>
          <p className="text-white/40 text-sm mb-5">
            {rate === null
              ? "Add a daily habit or a task due today to track your rate."
              : stats.dueToday - stats.completedToday > 0
                ? `${stats.dueToday - stats.completedToday} remaining today`
                : "All done for today"}
          </p>

          <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden mb-4">
            <motion.div
              key={rate ?? -1}
              initial={{ width: 0 }}
              animate={{ width: `${rate ?? 0}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full bg-gradient-to-r ${character.theme.gradient} rounded-full`}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
              <Shield className={`w-4 h-4 ${character.theme.text}`} />
              <span className="text-sm font-bold text-white" data-testid="text-score">{score} pts</span>
              <span className="text-white/30 text-xs">Total points</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Daily Completion Rate",
            value: rate === null ? "—" : `${rate}%`,
            sub: rate === null ? "No activities scheduled" : `${stats.completedToday}/${stats.dueToday} today`,
            icon: Target,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
          },
          {
            label: "Consecutive Days",
            value: `${days}`,
            sub: days === 1 ? "active day" : "active days in a row",
            icon: CalendarCheck,
            color: "text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            label: "Total Points",
            value: score.toLocaleString(),
            sub: "5 pts per completion",
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
            <div className={`w-10 h-10 rounded-2xl ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider mb-0.5">{card.label}</p>
            <h4 className="text-2xl font-display font-bold text-white">{card.value}</h4>
            <p className="text-white/30 text-xs mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
