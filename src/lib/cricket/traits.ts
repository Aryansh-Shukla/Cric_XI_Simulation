import type { Player, Role, Trait } from "./types";

/* ------------------------------------------------------------------ *
 * V2 trait system.
 *
 * Traits are referenced by stable ids. Display names live in the
 * catalogue and never leak into logic. Legacy display-name traits from
 * V1 data are mapped onto ids so nothing breaks.
 * ------------------------------------------------------------------ */

export type TraitId =
  // batting
  | "anchor"
  | "aggressive_opener"
  | "powerplay_specialist"
  | "middle_overs_controller"
  | "finisher"
  // bowling
  | "new_ball_specialist"
  | "middle_overs_specialist"
  | "death_specialist"
  | "strike_bowler"
  | "economy_specialist"
  | "spin_wizard"
  // general
  | "big_match_player"
  | "clutch_performer"
  | "consistent"
  | "pressure_player"
  | "match_winner"
  // leadership
  | "great_captain"
  | "tactical_captain"
  | "calm_leader";

export type TraitCategory = "Batting" | "Bowling" | "General" | "Leadership";

export interface TraitDef {
  id: TraitId;
  label: string;
  category: TraitCategory;
  blurb: string;
}

export const TRAIT_CATALOG: Record<TraitId, TraitDef> = {
  anchor: {
    id: "anchor",
    label: "Anchor",
    category: "Batting",
    blurb: "Steadies the middle overs and rarely throws it away.",
  },
  aggressive_opener: {
    id: "aggressive_opener",
    label: "Aggressive Opener",
    category: "Batting",
    blurb: "Takes on the new ball at the top.",
  },
  powerplay_specialist: {
    id: "powerplay_specialist",
    label: "Powerplay Specialist",
    category: "Batting",
    blurb: "Scores freely inside the fielding restrictions.",
  },
  middle_overs_controller: {
    id: "middle_overs_controller",
    label: "Middle Overs Controller",
    category: "Batting",
    blurb: "Keeps the scoreboard ticking through the middle.",
  },
  finisher: {
    id: "finisher",
    label: "Finisher",
    category: "Batting",
    blurb: "Thrives at the death, especially chasing.",
  },
  new_ball_specialist: {
    id: "new_ball_specialist",
    label: "New Ball Specialist",
    category: "Bowling",
    blurb: "Dangerous with the hard new ball.",
  },
  middle_overs_specialist: {
    id: "middle_overs_specialist",
    label: "Middle Overs Specialist",
    category: "Bowling",
    blurb: "Squeezes and strikes through the middle overs.",
  },
  death_specialist: {
    id: "death_specialist",
    label: "Death Specialist",
    category: "Bowling",
    blurb: "Holds his nerve bowling at the death.",
  },
  strike_bowler: {
    id: "strike_bowler",
    label: "Strike Bowler",
    category: "Bowling",
    blurb: "Bowls to take wickets, not to contain.",
  },
  economy_specialist: {
    id: "economy_specialist",
    label: "Economy Specialist",
    category: "Bowling",
    blurb: "Hard to get away.",
  },
  spin_wizard: {
    id: "spin_wizard",
    label: "Spin Wizard",
    category: "Bowling",
    blurb: "Elite control and turn.",
  },
  big_match_player: {
    id: "big_match_player",
    label: "Big Match Player",
    category: "General",
    blurb: "Raises his game in knockouts and finals.",
  },
  clutch_performer: {
    id: "clutch_performer",
    label: "Clutch Performer",
    category: "General",
    blurb: "Cool head when the game is on the line.",
  },
  consistent: {
    id: "consistent",
    label: "Consistent",
    category: "General",
    blurb: "Rarely has an off day.",
  },
  pressure_player: {
    id: "pressure_player",
    label: "Pressure Player",
    category: "General",
    blurb: "Barely notices the occasion.",
  },
  match_winner: {
    id: "match_winner",
    label: "Match Winner",
    category: "General",
    blurb: "Capable of winning a game on his own.",
  },
  great_captain: {
    id: "great_captain",
    label: "Great Captain",
    category: "Leadership",
    blurb: "Lifts the whole side.",
  },
  tactical_captain: {
    id: "tactical_captain",
    label: "Tactical Captain",
    category: "Leadership",
    blurb: "Sharp with bowling changes and fields.",
  },
  calm_leader: {
    id: "calm_leader",
    label: "Calm Leader",
    category: "Leadership",
    blurb: "Keeps the side settled in tight finishes.",
  },
};

export const traitLabel = (id: TraitId) => TRAIT_CATALOG[id].label;

/** V1 display-name traits mapped onto V2 ids. */
const LEGACY_TRAIT_MAP: Record<Trait, TraitId> = {
  "Ice Veins": "clutch_performer",
  "Death Overs Specialist": "death_specialist",
  "Powerplay Destroyer": "powerplay_specialist",
  "Spin Wizard": "spin_wizard",
  "Run Machine": "consistent",
  "Clutch Performer": "clutch_performer",
  "Big Match Player": "big_match_player",
  Finisher: "finisher",
  "Captain Fantastic": "great_captain",
  Wall: "anchor",
  "Strike Bowler": "strike_bowler",
};

/** Trait ids for a player — explicit ids first, legacy traits as fallback. */
export function traitIdsOf(p: Player): TraitId[] {
  if (p.traitIds?.length) return p.traitIds;
  const legacy = Array.isArray(p.traits) ? p.traits : [];
  return Array.from(new Set(legacy.map((t) => LEGACY_TRAIT_MAP[t]).filter(Boolean)));
}

export function hasTraitId(p: Player, id: TraitId): boolean {
  return traitIdsOf(p).includes(id);
}

/**
 * Derives edition-specific traits from a historical profile's ratings and era.
 * Deliberately sparse — most players get one or two, nobody gets everything.
 */
export function deriveTraitIds(input: {
  role: Role;
  batting: number;
  bowling: number;
  fielding: number;
  consistency: number;
  pressure: number;
  isCaptain: boolean;
  year: number;
  battingRank?: number; // 0-based position in the authored squad list
}): TraitId[] {
  const { role, batting, bowling, isCaptain, year, consistency, pressure } = input;
  const t = new Set<TraitId>();
  const topOrder = (input.battingRank ?? 9) <= 2;

  if (role === "Batsman" || role === "Wicketkeeper" || role === "AllRounder") {
    if (topOrder && batting >= 84 && year >= 2003) t.add("aggressive_opener");
    if (topOrder && batting >= 82 && year >= 2005) t.add("powerplay_specialist");
    if (batting >= 84 && consistency >= 72 && !topOrder) t.add("middle_overs_controller");
    if (batting >= 82 && year < 2000) t.add("anchor");
    if (batting >= 86 && consistency >= 78) t.add("anchor");
    if ((role === "Wicketkeeper" || role === "AllRounder") && batting >= 80) t.add("finisher");
    if (role === "Batsman" && batting >= 88 && pressure >= 76) t.add("finisher");
  }

  if (role === "PaceBowler" || role === "SpinBowler" || role === "AllRounder") {
    if (role === "PaceBowler" && bowling >= 82) t.add("new_ball_specialist");
    if (role === "SpinBowler" && bowling >= 80) t.add("middle_overs_specialist");
    if (role === "SpinBowler" && bowling >= 86) t.add("spin_wizard");
    if (role === "PaceBowler" && bowling >= 84 && year >= 2005) t.add("death_specialist");
    if (bowling >= 88) t.add("strike_bowler");
    if (bowling >= 78 && consistency >= 78) t.add("economy_specialist");
  }

  if (batting >= 93 || bowling >= 93) t.add("match_winner");
  if (consistency >= 84) t.add("consistent");
  if (pressure >= 84) t.add("pressure_player");
  if ((batting >= 90 || bowling >= 90) && pressure >= 78) t.add("big_match_player");
  if (pressure >= 88) t.add("clutch_performer");

  if (isCaptain) {
    t.add(batting >= 88 || bowling >= 88 ? "great_captain" : "tactical_captain");
    if (pressure >= 78) t.add("calm_leader");
  }

  // Keep the set meaningful: at most four traits per player.
  return [...t].slice(0, 4);
}

/* ------------------------------------------------------------------ *
 * Gameplay effects. All modifiers are deliberately small — base ratings
 * remain the dominant term in every calculation.
 * ------------------------------------------------------------------ */

export type SimPhase = "PP" | "MID" | "ACCEL" | "DEATH";

export interface TraitSituation {
  phase: SimPhase;
  chasing: boolean;
  knockout: boolean;
  /** 0 (routine) .. 1 (last over of a final). */
  pressure: number;
}

/** Batting skill delta from traits, in rating points (roughly ±1..7). */
export function battingTraitDelta(p: Player, s: TraitSituation): number {
  const ids = traitIdsOf(p);
  let d = 0;
  for (const id of ids) {
    switch (id) {
      case "aggressive_opener":
        if (s.phase === "PP") d += 3;
        break;
      case "powerplay_specialist":
        if (s.phase === "PP") d += 4;
        break;
      case "anchor":
        if (s.phase === "MID") d += 3;
        break;
      case "middle_overs_controller":
        if (s.phase === "MID" || s.phase === "ACCEL") d += 3;
        break;
      case "finisher":
        if (s.phase === "DEATH") d += s.chasing ? 5 : 3;
        break;
      case "match_winner":
        d += 1.5;
        break;
      case "consistent":
        d += 1;
        break;
      case "big_match_player":
        if (s.knockout) d += 3;
        break;
      default:
        break;
    }
  }
  return d + pressureResponse(p, s);
}

/** Bowling skill delta from traits, in rating points. */
export function bowlingTraitDelta(p: Player, s: TraitSituation): number {
  const ids = traitIdsOf(p);
  let d = 0;
  for (const id of ids) {
    switch (id) {
      case "new_ball_specialist":
        if (s.phase === "PP") d += 4;
        break;
      case "middle_overs_specialist":
        if (s.phase === "MID") d += 3;
        break;
      case "spin_wizard":
        if (s.phase === "MID" || s.phase === "ACCEL") d += 3;
        break;
      case "death_specialist":
        if (s.phase === "DEATH") d += 5;
        break;
      case "economy_specialist":
        d += 2;
        break;
      case "match_winner":
        d += 1.5;
        break;
      case "big_match_player":
        if (s.knockout) d += 3;
        break;
      default:
        break;
    }
  }
  return d + pressureResponse(p, s);
}

/** Extra wicket-taking multiplier for a bowler (1.0 = neutral). */
export function wicketTraitMultiplier(p: Player, s: TraitSituation): number {
  const ids = traitIdsOf(p);
  let m = 1;
  if (ids.includes("strike_bowler")) m *= 1.07;
  if (ids.includes("economy_specialist")) m *= 0.98;
  if (ids.includes("death_specialist") && s.phase === "DEATH") m *= 1.04;
  if (ids.includes("new_ball_specialist") && s.phase === "PP") m *= 1.04;
  return m;
}

/**
 * How a player copes with the occasion. High-pressure games cost ordinary
 * temperaments a couple of rating points; strong ones are unaffected or better.
 */
export function pressureResponse(p: Player, s: TraitSituation): number {
  if (s.pressure <= 0) return 0;
  const ids = traitIdsOf(p);
  const temperament = (p.stats.pressure + p.stats.consistency) / 2; // 0..100
  let resilience = (temperament - 70) / 10; // -7..+3 ish
  if (ids.includes("pressure_player")) resilience += 1.5;
  if (ids.includes("clutch_performer")) resilience += 1.5;
  if (ids.includes("big_match_player") && s.knockout) resilience += 1;
  if (ids.includes("calm_leader")) resilience += 0.5;
  const swing = Math.max(-4, Math.min(3, resilience));
  return swing * s.pressure;
}
