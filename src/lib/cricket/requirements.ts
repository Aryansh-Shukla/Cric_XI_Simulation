import type { Player, GameMode } from "./types";

export interface Requirement {
  key: string;
  label: string;
  required: number;
  matches: (p: Player) => boolean;
}

export interface RequirementStatus extends Requirement {
  filled: number;
  satisfied: boolean;
}

export function requirementsFor(_mode: GameMode): Requirement[] {
  return [
    { key: "wk", label: "Wicketkeeper", required: 1, matches: (p) => p.role === "Wicketkeeper" },
    {
      key: "opener",
      label: "Opener",
      required: 2,
      matches: (p) => p.role === "Batsman" || p.role === "Wicketkeeper",
    },
    {
      key: "mid",
      label: "Middle Order",
      required: 2,
      matches: (p) => p.role === "Batsman" || p.role === "AllRounder" || p.role === "Wicketkeeper",
    },
    { key: "ar", label: "All-rounder", required: 1, matches: (p) => p.role === "AllRounder" },
    { key: "pace", label: "Pace Bowlers", required: 2, matches: (p) => p.role === "PaceBowler" },
    { key: "spin", label: "Spinner", required: 1, matches: (p) => p.role === "SpinBowler" },
    {
      key: "bowl",
      label: "Bowling Options",
      required: 5,
      matches: (p) => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder",
    },
  ];
}

export function computeStatus(players: Player[], mode: GameMode): RequirementStatus[] {
  const reqs = requirementsFor(mode);
  return reqs.map((r) => {
    const filled = players.filter(r.matches).length;
    return { ...r, filled, satisfied: filled >= r.required };
  });
}

export interface PickabilityContext {
  picked: Player[];
  mode: GameMode;
  remainingSlots: number;
}

export interface Pickability {
  canPick: boolean;
  reason?: string;
}

const ROLES = ["Batsman", "Wicketkeeper", "AllRounder", "PaceBowler", "SpinBowler"] as const;
type RoleKey = (typeof ROLES)[number];

/** Which roles can satisfy each requirement, derived from the requirement matcher. */
function rolesSatisfying(req: Requirement): RoleKey[] {
  return ROLES.filter((role) => req.matches({ role } as unknown as Player));
}

/**
 * Exact feasibility: is there ANY distribution of the remaining slots across the
 * five roles that satisfies every requirement? The old heuristic only looked at
 * the largest single deficit, so two disjoint one-slot deficits (e.g. a spinner
 * AND a pace bowler with one slot left) slipped through and dead-ended the draft.
 */
export function canCompleteXI(picked: Player[], mode: GameMode, slotsLeft: number): boolean {
  const reqs = requirementsFor(mode)
    .map((r) => ({
      roles: rolesSatisfying(r),
      deficit: Math.max(0, r.required - picked.filter(r.matches).length),
    }))
    .filter((r) => r.deficit > 0);
  if (!reqs.length) return true;
  if (slotsLeft <= 0) return false;

  const counts: Record<RoleKey, number> = {
    Batsman: 0,
    Wicketkeeper: 0,
    AllRounder: 0,
    PaceBowler: 0,
    SpinBowler: 0,
  };
  const batsmenPicked = picked.filter((p) => p.role === "Batsman").length;

  const satisfied = () =>
    reqs.every((r) => r.roles.reduce((s, role) => s + counts[role], 0) >= r.deficit);

  // Enumerate every composition of slotsLeft across 5 roles (at most ~1.4k cases).
  const walk = (idx: number, left: number): boolean => {
    if (idx === ROLES.length) return left >= 0 && satisfied();
    const role = ROLES[idx];
    const cap = role === "Batsman" ? Math.min(left, Math.max(0, 7 - batsmenPicked)) : left;
    for (let n = cap; n >= 0; n--) {
      counts[role] = n;
      if (walk(idx + 1, left - n)) {
        counts[role] = 0;
        return true;
      }
    }
    counts[role] = 0;
    return false;
  };
  return walk(0, slotsLeft);
}

/**
 * Enforce hard rules at pick-time so an invalid XI is unreachable.
 * - Franchise: max 4 overseas
 * - Max 7 specialist batsmen (excluding WK)
 * - Ensure remaining slots can still satisfy every unmet requirement
 */
export function canPickPlayer(player: Player, ctx: PickabilityContext): Pickability {
  const { picked, mode, remainingSlots } = ctx;

  if (mode === "FRANCHISE_T20" && player.isOverseas) {
    const overseas = picked.filter((p) => p.isOverseas).length;
    if (overseas >= 4) return { canPick: false, reason: "Max 4 overseas players" };
  }

  if (player.role === "Batsman") {
    const batsmen = picked.filter((p) => p.role === "Batsman").length;
    if (batsmen >= 7) return { canPick: false, reason: "Max 7 specialist batsmen" };
  }

  // Feasibility: after adding this player, can the remaining slots still complete a legal XI?
  const hypothetical = [...picked, player];
  if (!canCompleteXI(hypothetical, mode, remainingSlots - 1)) {
    return { canPick: false, reason: "Would make the XI unfillable" };
  }
  return { canPick: true };
}

export function overseasCount(players: Player[]) {
  return players.filter((p) => p.isOverseas).length;
}

export function estimatedRating(players: Player[]): number {
  if (!players.length) return 0;
  const roleOverall = (p: Player) => {
    switch (p.role) {
      case "Batsman":
        return p.stats.batting;
      case "PaceBowler":
      case "SpinBowler":
        return p.stats.bowling;
      case "AllRounder":
        return (p.stats.batting + p.stats.bowling) / 2;
      case "Wicketkeeper":
        return (p.stats.batting + p.stats.fielding) / 2;
    }
  };
  const sum = players.reduce((s, p) => s + roleOverall(p), 0);
  return Math.round(sum / players.length);
}
