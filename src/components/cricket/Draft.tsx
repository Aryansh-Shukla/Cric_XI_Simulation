import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Lock, Sparkles, Users, Globe2, TrendingUp, Shuffle, Calendar, Users2, AlertTriangle } from "lucide-react";
import { PlayerCard } from "./PlayerCard";
import { SQUADS_BY_MODE, MODE_LABELS } from "@/lib/cricket/data";
import type { Difficulty, GameMode, Player, Squad } from "@/lib/cricket/types";
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

const REROLL_LIMIT = 4;

function pickChoices(squad: Squad, picked: Player[], mode: GameMode, remainingSlots: number, prioritizeValid = false): Player[] {
  const usedIds = new Set(picked.map(p => p.id));
  const pool = squad.players.filter(p => !usedIds.has(p.id));
  if (!pool.length) return [];
  if (prioritizeValid) {
    const valid = pool.filter(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick);
    if (valid.length >= 5) return shuffle(valid).slice(0, 5);
    const invalid = shuffle(pool.filter(p => !valid.includes(p)));
    return [...shuffle(valid), ...invalid].slice(0, 5);
  }
  return shuffle(pool).slice(0, 5);
}

export function Draft({ mode, difficulty, onComplete }: Props) {
  const [picked, setPicked] = useState<Player[]>([]);
  const round = picked.length + 1;
  const remainingSlots = 11 - picked.length;

  const pool = useMemo(() => SQUADS_BY_MODE[mode], [mode]);

  const [squad, setSquad] = useState<Squad>(() => shuffle(pool)[0]);
  const [choices, setChoices] = useState<Player[]>(() => pickChoices(pool[0], [], mode, 11));
  const [recentSquadIds, setRecentSquadIds] = useState<string[]>([]);
  const [yearRerolls, setYearRerolls] = useState(REROLL_LIMIT);
  const [teamRerolls, setTeamRerolls] = useState(REROLL_LIMIT);

  // Advance to a fresh squad + choices when a player is picked (round changes)
  const advanceRound = useCallback((nextPicked: Player[]) => {
    if (nextPicked.length >= 11) return;
    const avoid = new Set([...recentSquadIds.slice(-3), squad.id]);
    const candidates = pool.filter(s => !avoid.has(s.id));
    const nextSquad = (candidates.length ? shuffle(candidates) : shuffle(pool))[0];
    setSquad(nextSquad);
    setChoices(pickChoices(nextSquad, nextPicked, mode, 11 - nextPicked.length));
    setRecentSquadIds(r => [...r, nextSquad.id].slice(-5));
  }, [pool, mode, recentSquadIds, squad.id]);

  const select = (p: Player) => {
    const check = canPickPlayer(p, { picked, mode, remainingSlots });
    if (!check.canPick) return;
    const next = [...picked, p];
    setPicked(next);
    if (next.length === 11) {
      setTimeout(() => onComplete(next), 400);
    } else {
      advanceRound(next);
    }
  };

  const rerollSameYear = () => {
    if (yearRerolls <= 0) return;
    const avoid = new Set([...recentSquadIds, squad.id]);
    let candidates = pool.filter(s => s.year === squad.year && !avoid.has(s.id));
    if (!candidates.length) candidates = pool.filter(s => s.year === squad.year && s.id !== squad.id);
    if (!candidates.length) return;
    const next = shuffle(candidates)[0];
    setSquad(next);
    setChoices(pickChoices(next, picked, mode, remainingSlots));
    setRecentSquadIds(r => [...r, next.id].slice(-5));
    setYearRerolls(n => n - 1);
  };

  const rerollSameTeam = () => {
    if (teamRerolls <= 0) return;
    const avoid = new Set([...recentSquadIds, squad.id]);
    let candidates = pool.filter(s => s.country === squad.country && !avoid.has(s.id));
    if (!candidates.length) candidates = pool.filter(s => s.country === squad.country && s.id !== squad.id);
    if (!candidates.length) return;
    const next = shuffle(candidates)[0];
    setSquad(next);
    setChoices(pickChoices(next, picked, mode, remainingSlots));
    setRecentSquadIds(r => [...r, next.id].slice(-5));
    setTeamRerolls(n => n - 1);
  };

  const reshuffle = () => {
    // Try same squad first, prioritizing valid picks
    const fresh = pickChoices(squad, picked, mode, remainingSlots, true);
    const anyValid = fresh.some(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick);
    if (fresh.length && anyValid) {
      setChoices(fresh);
      return;
    }
    // Fall back to a different squad that contains a valid pick
    const usedIds = new Set(picked.map(p => p.id));
    const rescueSquad = shuffle(pool).find(s =>
      s.players.some(pl => !usedIds.has(pl.id) && canPickPlayer(pl, { picked, mode, remainingSlots }).canPick)
    );
    if (rescueSquad) {
      setSquad(rescueSquad);
      setChoices(pickChoices(rescueSquad, picked, mode, remainingSlots, true));
      setRecentSquadIds(r => [...r, rescueSquad.id].slice(-5));
    }
  };

  const validCount = choices.filter(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick).length;
  const softLocked = choices.length > 0 && validCount === 0;

  // Auto-rescue: if we deal a fully locked round, reshuffle once so the user never soft-locks.
  useEffect(() => {
    if (softLocked) reshuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [softLocked]);

  const status = computeStatus(picked, mode);
  const overseas = overseasCount(picked);
  const rating = estimatedRating(picked);
  const chem = activatedChemistry(picked);

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
                {difficulty === "Legend" ? "a mystery squad" : squad.label}
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

        {/* Re-roll toolbar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={rerollSameYear}
            disabled={yearRerolls <= 0}
            className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:ring-1 hover:ring-[color:var(--gold)]/50"
          >
            <Calendar className="h-3.5 w-3.5 text-gold" />
            Another Team · {squad.year}
            <span className="rounded-full bg-[color:var(--gold)]/15 px-1.5 py-0.5 text-[10px] text-gold">{yearRerolls}</span>
          </button>
          <button
            onClick={rerollSameTeam}
            disabled={teamRerolls <= 0}
            className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:ring-1 hover:ring-[color:var(--gold)]/50"
          >
            <Users2 className="h-3.5 w-3.5 text-gold" />
            Same Team · Different Year
            <span className="rounded-full bg-[color:var(--gold)]/15 px-1.5 py-0.5 text-[10px] text-gold">{teamRerolls}</span>
          </button>
          <button
            onClick={reshuffle}
            className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium hover:ring-1 hover:ring-[color:var(--accent)]/50"
          >
            <Shuffle className="h-3.5 w-3.5 text-[color:var(--accent)]" />
            Reshuffle Squad
          </button>
          {softLocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10 px-3 py-1 text-[11px] text-[color:var(--destructive)]">
              <AlertTriangle className="h-3 w-3" />
              No valid picks — auto-reshuffling
            </span>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,320px]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${round}-${squad.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {choices.map((pl) => {
                  const check = canPickPlayer(pl, { picked, mode, remainingSlots });
                  return (
                    <div key={pl.id} className="relative">
                      <div className={check.canPick ? "" : "pointer-events-none opacity-40 grayscale"}>
                        <PlayerCard
                          player={pl}
                          difficulty={difficulty}
                          squadLabel={difficulty === "Legend" ? undefined : squad.label}
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