import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Lock, Sparkles, Users, Globe2, TrendingUp } from "lucide-react";
import { PlayerCard } from "./PlayerCard";
import { SQUADS_BY_MODE, MODE_LABELS } from "@/lib/cricket/data";
import type { Difficulty, GameMode, Player } from "@/lib/cricket/types";
import { computeStatus, canPickPlayer, overseasCount, estimatedRating } from "@/lib/cricket/requirements";
import { activatedChemistry } from "@/lib/cricket/simulation";

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

  const remainingSlots = 11 - picked.length;
  const status = computeStatus(picked, mode);
  const overseas = overseasCount(picked);
  const rating = estimatedRating(picked);
  const chem = activatedChemistry(picked);

  const select = (p: Player) => {
    const check = canPickPlayer(p, { picked, mode, remainingSlots });
    if (!check.canPick) return;
    const next = [...picked, p];
    setPicked(next);
    if (next.length === 11) setTimeout(() => onComplete(next), 400);
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,320px]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={round}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {currentRound.choices.map((pl) => {
                  const check = canPickPlayer(pl, { picked, mode, remainingSlots });
                  return (
                    <div key={pl.id} className="relative">
                      <div className={check.canPick ? "" : "pointer-events-none opacity-40 grayscale"}>
                        <PlayerCard
                          player={pl}
                          difficulty={difficulty}
                          squadLabel={difficulty === "Legend" ? undefined : currentRound.squad.label}
                          onSelect={() => select(pl)}
                        />
                      </div>
                      {!check.canPick && (
                        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1 text-[11px] text-white shadow-lg">
                            <Lock className="h-3 w-3" /> {check.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {picked.length > 0 && (
              <section className="mt-10">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Your XI so far</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {picked.map((pl, i) => (
                    <motion.span
                      key={pl.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass-card rounded-full px-3 py-1.5 text-sm"
                    >
                      <span className="mr-2 text-gold">{i + 1}.</span>
                      {pl.name}
                    </motion.span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Persistent team sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Team Rating</div>
                <TrendingUp className="h-4 w-4 text-gold" />
              </div>
              <div className="mt-1 text-4xl font-bold text-gold">{rating || "--"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{picked.length}/11 drafted · {remainingSlots} slots left</div>
            </div>

            <div className="glass-card rounded-2xl p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Requirements</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {status.map(r => (
                  <li key={r.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {r.satisfied
                        ? <CheckCircle2 className="h-4 w-4 text-[color:var(--accent)]" />
                        : <Circle className="h-4 w-4 text-muted-foreground" />}
                      <span className={r.satisfied ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                    </span>
                    <span className={`text-xs font-mono ${r.satisfied ? "text-[color:var(--accent)]" : "text-muted-foreground"}`}>
                      {r.filled}/{r.required}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {mode === "FRANCHISE_T20" && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Globe2 className="h-3.5 w-3.5" /> Overseas
                  </div>
                  <div className={`text-sm font-bold ${overseas >= 4 ? "text-[color:var(--destructive)]" : "text-gold"}`}>
                    {overseas}/4
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < overseas ? "bg-[color:var(--gold)]" : "bg-white/10"}`} />
                  ))}
                </div>
                {overseas >= 4 && (
                  <div className="mt-2 text-[11px] text-[color:var(--destructive)]">Overseas cap reached — locked.</div>
                )}
              </div>
            )}

            {chem.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Chemistry
                </div>
                <div className="mt-2 space-y-1.5">
                  {chem.map(c => (
                    <div key={c.pair} className="rounded-lg border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-2 py-1.5 text-xs">
                      <div className="font-medium text-[color:var(--accent)]">{c.label}</div>
                      <div className="text-[10px] text-muted-foreground">{c.pair}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Balance
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <BalancePill label="Batting" value={picked.filter(pl => pl.role === "Batsman" || pl.role === "Wicketkeeper" || pl.role === "AllRounder").length} />
                <BalancePill label="Bowling" value={picked.filter(pl => pl.role === "PaceBowler" || pl.role === "SpinBowler" || pl.role === "AllRounder").length} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function BalancePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-gold">{value}</div>
    </div>
  );
}