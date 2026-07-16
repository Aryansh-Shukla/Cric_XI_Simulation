import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerCard } from "./PlayerCard";
import { SQUADS_BY_MODE, MODE_LABELS } from "@/lib/cricket/data";
import type { Difficulty, GameMode, Player } from "@/lib/cricket/types";

interface Props {
  mode: GameMode;
  difficulty: Difficulty;
  onComplete: (players: Player[]) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Draft({ mode, difficulty, onComplete }: Props) {
  const [picked, setPicked] = useState<Player[]>([]);
  const round = picked.length + 1;

  const currentRound = useMemo(() => {
    const pool = SQUADS_BY_MODE[mode];
    const usedIds = new Set(picked.map(p => p.id));
    const squad = shuffle(pool)[0];
    const choices = shuffle(squad.players.filter(p => !usedIds.has(p.id))).slice(0, 5);
    return { squad, choices };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, mode]);

  const select = (p: Player) => {
    const next = [...picked, p];
    setPicked(next);
    if (next.length === 11) setTimeout(() => onComplete(next), 400);
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">{MODE_LABELS[mode].title}</div>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">
              Round {round} <span className="text-muted-foreground">/ 11</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one player from{" "}
              <span className="font-medium text-foreground">
                {difficulty === "Legend" ? "a mystery squad" : currentRound.squad.label}
              </span>
            </p>
          </div>

          <div className="glass-card flex items-center gap-1 rounded-full p-1">
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-all ${
                  i < picked.length
                    ? "bg-[color:var(--gold)]"
                    : i === picked.length
                      ? "bg-[color:var(--accent)] animate-pulse"
                      : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            {currentRound.choices.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                difficulty={difficulty}
                squadLabel={difficulty === "Legend" ? undefined : currentRound.squad.label}
                onSelect={() => select(p)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {picked.length > 0 && (
          <section className="mt-12">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Your XI</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {picked.map((p, i) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card rounded-full px-3 py-1.5 text-sm"
                >
                  <span className="mr-2 text-gold">{i + 1}.</span>
                  {p.name}
                </motion.span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}