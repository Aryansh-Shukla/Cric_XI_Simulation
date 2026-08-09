import type { Player, Trait } from "../types";

// Derived, phase-specific player attributes with sensible fallbacks so
// existing squad data (which only has base stats) still works.
export interface PlayerAttrs {
  bat: number;
  bowl: number;
  ppBat: number;
  midBat: number;
  deathBat: number;
  boundary: number;
  wicketPres: number;
  ppBowl: number;
  midBowl: number;
  deathBowl: number;
  control: number;
  stamina: number;
  fielding: number;
  pressure: number;
  leadership: number;
  isBatter: boolean;
  isWk: boolean;
  isBowler: boolean;
  isPace: boolean;
  isSpin: boolean;
  isAr: boolean;
  hasTrait: (t: Trait) => boolean;
}

export function attrs(p: Player): PlayerAttrs {
  const s = p.stats;
  const isBatter = p.role === "Batsman";
  const isWk = p.role === "Wicketkeeper";
  const isPace = p.role === "PaceBowler";
  const isSpin = p.role === "SpinBowler";
  const isBowler = isPace || isSpin;
  const isAr = p.role === "AllRounder";
  const traits: Trait[] = Array.isArray(p.traits) ? p.traits : [];
  const hasTrait = (t: Trait) => traits.includes(t);

  const bat = s.batting;
  const bowl = s.bowling;
  const batPenalty = isBowler ? 22 : isAr ? 4 : 0;
  const bowlPenalty = isBatter || isWk ? 26 : isAr ? 0 : 0;

  return {
    bat,
    bowl,
    ppBat: bat + (hasTrait("Powerplay Destroyer") ? 6 : 0) - batPenalty,
    midBat: bat + (isAr ? 2 : 0) + (hasTrait("Wall") ? 3 : 0) - batPenalty * 0.7,
    deathBat:
      bat +
      (hasTrait("Finisher") ? 8 : 0) +
      (hasTrait("Death Overs Specialist") ? 4 : 0) +
      s.pressure * 0.08 -
      batPenalty,
    boundary: bat * 0.9 + (hasTrait("Powerplay Destroyer") ? 6 : 0),
    wicketPres: s.consistency,
    ppBowl: bowl + (isPace ? 6 : 0) + (isSpin ? -6 : 0) - bowlPenalty,
    midBowl: bowl + (isSpin ? 5 : 0) + (hasTrait("Spin Wizard") ? 4 : 0) - bowlPenalty * 0.9,
    deathBowl:
      bowl +
      (hasTrait("Death Overs Specialist") ? 10 : 0) +
      (isPace ? 4 : 0) +
      s.pressure * 0.08 -
      bowlPenalty,
    control: bowl * 0.5 + s.consistency * 0.5,
    stamina: s.fitness,
    fielding: s.fielding,
    pressure: s.pressure,
    leadership: s.leadership,
    isBatter,
    isWk,
    isBowler,
    isPace,
    isSpin,
    isAr,
    hasTrait,
  };
}

/**
 * Build a logical batting order: openers/top order first, then middle,
 * all-rounders, and tailenders. Wicketkeeper slots based on batting rating.
 */
export function battingOrder(players: Player[]): Player[] {
  const score = (p: Player) => {
    switch (p.role) {
      case "Batsman":
        return p.stats.batting + 10;
      case "Wicketkeeper":
        return p.stats.batting + 4;
      case "AllRounder":
        return p.stats.batting - 6;
      case "PaceBowler":
      case "SpinBowler":
        return p.stats.batting - 30;
    }
  };
  return [...players].sort((a, b) => score(b) - score(a));
}

/** Bowlers usable in an innings (specialists + all-rounders, plus fallback part-timers). */
export function bowlingPool(players: Player[]): Player[] {
  const bowlers = players.filter(
    (p) => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder",
  );
  if (bowlers.length >= 5) return bowlers;
  const others = players
    .filter((p) => !bowlers.includes(p))
    .sort((a, b) => b.stats.bowling - a.stats.bowling);
  while (bowlers.length < 5 && others.length) bowlers.push(others.shift()!);
  return bowlers;
}

export function wicketkeeper(players: Player[]): Player | undefined {
  return players.find((p) => p.role === "Wicketkeeper");
}
