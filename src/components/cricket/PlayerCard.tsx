import { motion } from "framer-motion";
import { Crown, Shield, Zap, Wind, Star } from "lucide-react";
import type { Player, Difficulty } from "@/lib/cricket/types";

const roleBadge = (role: Player["role"]) => {
  switch (role) {
    case "Wicketkeeper": return { label: "WK", icon: Shield };
    case "PaceBowler":   return { label: "Pace", icon: Zap };
    case "SpinBowler":   return { label: "Spin", icon: Wind };
    case "AllRounder":   return { label: "All-rounder", icon: Star };
    default:              return { label: "Batter", icon: Star };
  }
};

export function PlayerCard({
  player,
  onSelect,
  selected,
  difficulty = "Medium",
  squadLabel,
}: {
  player: Player;
  onSelect?: () => void;
  selected?: boolean;
  difficulty?: Difficulty;
  squadLabel?: string;
}) {
  const b = roleBadge(player.role);
  const Icon = b.icon;
  const showRole = difficulty === "Easy";
  const showCountry = difficulty === "Easy" || difficulty === "Medium";
  const initials = player.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`glass-card group relative flex w-full flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all ${
        selected ? "ring-2 ring-[color:var(--gold)] glow-gold" : "hover:ring-1 hover:ring-[color:var(--gold)]/50"
      }`}
    >
      <div className="flex w-full items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--muted)] to-[color:var(--card)] text-lg font-bold">
          <div className="flex h-full w-full items-center justify-center text-gold">{initials}</div>
          {player.isCaptain && (
            <span className="absolute -top-1 -right-1 rounded-full bg-[color:var(--gold)] p-1 text-[color:var(--primary-foreground)] shadow">
              <Crown className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{player.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {showCountry && <span>{player.country}</span>}
            {squadLabel && showCountry && <span className="opacity-40">•</span>}
            {squadLabel && <span className="truncate">{squadLabel}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {showRole && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/60 px-2 py-0.5 text-[10px] font-medium">
            <Icon className="h-3 w-3" /> {b.label}
          </span>
        )}
        {player.isOverseas && (
          <span className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--accent)]">
            Overseas
          </span>
        )}
        {player.isCaptain && (
          <span className="rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-2 py-0.5 text-[10px] font-medium text-gold">
            Captain
          </span>
        )}
      </div>
    </motion.button>
  );
}