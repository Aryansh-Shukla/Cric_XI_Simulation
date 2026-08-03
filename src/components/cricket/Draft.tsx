import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Lock, Sparkles, Users, Globe2, TrendingUp, Shuffle, Calendar, Users2, AlertTriangle } from "lucide-react";
import { PlayerCard } from "./PlayerCard";
import { MODE_LABELS } from "@/lib/cricket/data";
import type { Difficulty, GameMode, Player, Squad } from "@/lib/cricket/types";
import { computeStatus, canPickPlayer, overseasCount, estimatedRating } from "@/lib/cricket/requirements";
import { activatedChemistry } from "@/lib/cricket/simulation";
import { DraftPoolService } from "@/services/DraftPoolService";
import { PlayerEligibilityService } from "@/services/PlayerEligibilityService";
import { RerollService, NO_ALTERNATIVE_MESSAGE } from "@/services/RerollService";

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
  // Canonical enforcement: every profile of an already-drafted cricketer is removed.
  const pool = PlayerEligibilityService.filterEligible(squad.players, picked);
  if (!pool.length) return [];
  if (prioritizeValid) {
    const valid = pool.filter(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick);
    if (valid.length >= 5) return shuffle(valid).slice(0, 5);
    const invalid = shuffle(pool.filter(p => !valid.includes(p)));
    return [...shuffle(valid), ...invalid].slice(0, 5);
  }
  return shuffle(pool).slice(0, 5);
}

/** True when the squad can offer at least one legal pick for the current XI. */
function squadHasValidPick(squad: Squad, picked: Player[], mode: GameMode, remainingSlots: number): boolean {
  return PlayerEligibilityService.filterEligible(squad.players, picked)
    .some(pl => canPickPlayer(pl, { picked, mode, remainingSlots }).canPick);
}

/**
 * Emergency recovery: find a squad that guarantees a legal pick. Falls back to a
 * cross-pool selection of legal players so the draft can never dead-end.
 */
function rescueDeal(
  pool: Squad[], picked: Player[], mode: GameMode, remainingSlots: number,
): { squad: Squad | null; choices: Player[] } {
  const shuffled = shuffle(pool);
  const rescueSquad = shuffled.find(s => squadHasValidPick(s, picked, mode, remainingSlots));
  if (rescueSquad) {
    return { squad: rescueSquad, choices: pickChoices(rescueSquad, picked, mode, remainingSlots, true) };
  }
  // Last resort: build a mixed pool of any legal player anywhere in the catalogue.
  const everyone = PlayerEligibilityService.filterEligible(shuffled.flatMap(s => s.players), picked);
  const legal = everyone.filter(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick);
  if (legal.length) return { squad: null, choices: shuffle(legal).slice(0, 5) };
  // Absolute floor: ignore soft feasibility guards, keep only hard caps satisfied.
  const relaxed = everyone.filter(p => {
    if (mode === "FRANCHISE_T20" && p.isOverseas && picked.filter(x => x.isOverseas).length >= 4) return false;
    if (p.role === "Batsman" && picked.filter(x => x.role === "Batsman").length >= 7) return false;
    return true;
  });
  return { squad: null, choices: shuffle(relaxed).slice(0, 5) };
}

export function Draft({ mode, difficulty, onComplete }: Props) {
  const [picked, setPicked] = useState<Player[]>([]);
  const round = picked.length + 1;
  const remainingSlots = 11 - picked.length;

  const pool = useMemo(() => DraftPoolService.getPool(mode), [mode]);

  // Single source of truth: label and players MUST come from the same HistoricalSquad.
  const [squad, setSquad] = useState<Squad>(() => shuffle(pool)[0]);
  const [choices, setChoices] = useState<Player[]>(() => []);
  const [emergency, setEmergency] = useState(false);
  const [recentSquadIds, setRecentSquadIds] = useState<string[]>([]);
  const [yearRerolls, setYearRerolls] = useState(REROLL_LIMIT);
  const [teamRerolls, setTeamRerolls] = useState(REROLL_LIMIT);
  const rescueAttempts = useRef(0);

  // Deal the opening round from the squad that is actually on screen.
  useEffect(() => {
    setChoices(pickChoices(squad, [], mode, 11, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance to a fresh squad + choices when a player is picked (round changes)
  const advanceRound = useCallback((nextPicked: Player[]) => {
    if (nextPicked.length >= 11) return;
    const slots = 11 - nextPicked.length;
    const avoid = new Set([...recentSquadIds.slice(-3), squad.id]);
    const candidates = shuffle(pool.filter(s => !avoid.has(s.id)));
    // Prefer a squad that can actually offer a legal pick — never deal a dead round.
    const nextSquad =
      candidates.find(s => squadHasValidPick(s, nextPicked, mode, slots))
      ?? shuffle(pool).find(s => squadHasValidPick(s, nextPicked, mode, slots))
      ?? candidates[0]
      ?? shuffle(pool)[0];
    setSquad(nextSquad);
    setEmergency(false);
    setChoices(pickChoices(nextSquad, nextPicked, mode, slots, true));
    setRecentSquadIds(r => [...r, nextSquad.id].slice(-5));
  }, [pool, mode, recentSquadIds, squad.id]);

  const select = (p: Player) => {
    const check = canPickPlayer(p, { picked, mode, remainingSlots });
    if (!check.canPick) return;
    const next = [...picked, p];
    setPicked(next);
    rescueAttempts.current = 0;
    if (next.length === 11) {
      setTimeout(() => onComplete(next), 400);
    } else {
      advanceRound(next);
    }
  };

  // Reroll options come straight from the historical repositories.
  const sameYearOptions = useMemo(
    () => RerollService.sameYearDifferentTeam(squad, mode, recentSquadIds),
    [squad, mode, recentSquadIds],
  );
  const sameTeamOptions = useMemo(
    () => RerollService.sameTeamDifferentYear(squad, mode, recentSquadIds),
    [squad, mode, recentSquadIds],
  );

  const applyReroll = (candidates: Squad[]) => {
    const fallback = candidates.length ? candidates : [];
    if (!fallback.length) return false;
    const shuffled = shuffle(fallback);
    const next = shuffled.find(s => squadHasValidPick(s, picked, mode, remainingSlots)) ?? shuffled[0];
    setSquad(next);
    setEmergency(false);
    setChoices(pickChoices(next, picked, mode, remainingSlots, true));
    setRecentSquadIds(r => [...r, next.id].slice(-5));
    return true;
  };

  const rerollSameYear = () => {
    if (yearRerolls <= 0) return;
    const alt = sameYearOptions.length
      ? sameYearOptions
      : RerollService.sameYearDifferentTeam(squad, mode);
    if (applyReroll(alt)) setYearRerolls(n => n - 1);
  };

  const rerollSameTeam = () => {
    if (teamRerolls <= 0) return;
    const alt = sameTeamOptions.length
      ? sameTeamOptions
      : RerollService.sameTeamDifferentYear(squad, mode);
    if (applyReroll(alt)) setTeamRerolls(n => n - 1);
  };

  const sameYearAvailable = sameYearOptions.length > 0 || RerollService.sameYearDifferentTeam(squad, mode).length > 0;
  const sameTeamAvailable = sameTeamOptions.length > 0 || RerollService.sameTeamDifferentYear(squad, mode).length > 0;

  const reshuffle = useCallback(() => {
    // Try same squad first, prioritizing valid picks
    const fresh = pickChoices(squad, picked, mode, remainingSlots, true);
    if (fresh.length && fresh.some(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick)) {
      setEmergency(false);
      setChoices(fresh);
      return;
    }
    // Emergency recovery — guaranteed to produce a playable round.
    const rescue = rescueDeal(pool, picked, mode, remainingSlots);
    if (!rescue.choices.length) return;
    if (rescue.squad) {
      setSquad(rescue.squad);
      setEmergency(false);
      setRecentSquadIds(r => [...r, rescue.squad!.id].slice(-5));
    } else {
      setEmergency(true);
    }
    setChoices(rescue.choices);
  }, [pool, picked, mode, remainingSlots, squad]);

  const validCount = choices.filter(p => canPickPlayer(p, { picked, mode, remainingSlots }).canPick).length;
  const softLocked = validCount === 0;

  // Auto-rescue: keep re-dealing until a legal pick exists. Depends on `choices`
  // so a rescue that still fails triggers another attempt instead of dead-ending.
  useEffect(() => {
    if (picked.length >= 11) return;
    if (!softLocked) { rescueAttempts.current = 0; return; }
    // Bounded retries: the feasibility guard makes a true dead-end impossible,
    // but never spin the renderer if one somehow occurs.
    if (rescueAttempts.current >= 8) return;
    rescueAttempts.current += 1;
    reshuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [softLocked, choices, picked.length]);

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
                {difficulty === "Legend" ? "a mystery squad" : emergency ? "the emergency draft pool" : squad.label}
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
            disabled={yearRerolls <= 0 || !sameYearAvailable}
            title={sameYearAvailable ? undefined : NO_ALTERNATIVE_MESSAGE}
            className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:ring-1 hover:ring-[color:var(--gold)]/50"
          >
            <Calendar className="h-3.5 w-3.5 text-gold" />
            Another Team · {squad.year}
            <span className="rounded-full bg-[color:var(--gold)]/15 px-1.5 py-0.5 text-[10px] text-gold">{yearRerolls}</span>
          </button>
          <button
            onClick={rerollSameTeam}
            disabled={teamRerolls <= 0 || !sameTeamAvailable}
            title={sameTeamAvailable ? undefined : NO_ALTERNATIVE_MESSAGE}
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
          {(!sameYearAvailable || !sameTeamAvailable) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] text-muted-foreground">
              {NO_ALTERNATIVE_MESSAGE}
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
                          squadLabel={difficulty === "Legend" || emergency ? undefined : squad.label}
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