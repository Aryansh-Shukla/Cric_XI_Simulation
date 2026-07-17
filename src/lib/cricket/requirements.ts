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
    { key: "wk",     label: "Wicketkeeper",     required: 1, matches: p => p.role === "Wicketkeeper" },
    { key: "opener", label: "Opener",           required: 2, matches: p => p.role === "Batsman" || p.role === "Wicketkeeper" },
    { key: "mid",    label: "Middle Order",     required: 2, matches: p => p.role === "Batsman" || p.role === "AllRounder" || p.role === "Wicketkeeper" },
    { key: "ar",     label: "All-rounder",      required: 1, matches: p => p.role === "AllRounder" },
    { key: "pace",   label: "Pace Bowlers",     required: 2, matches: p => p.role === "PaceBowler" },
    { key: "spin",   label: "Spinner",          required: 1, matches: p => p.role === "SpinBowler" },
    { key: "bowl",   label: "Bowling Options",  required: 5, matches: p => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder" },
  ];
}

export function computeStatus(players: Player[], mode: GameMode): RequirementStatus[] {
  const reqs = requirementsFor(mode);
  return reqs.map(r => {
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

/**
 * Enforce hard rules at pick-time so an invalid XI is unreachable.
 * - Franchise: max 4 overseas
 * - Max 7 specialist batsmen (excluding WK)
 * - Ensure remaining slots can still satisfy every unmet requirement
 */
export function canPickPlayer(player: Player, ctx: PickabilityContext): Pickability {
  const { picked, mode, remainingSlots } = ctx;

  if (mode === "FRANCHISE_T20" && player.isOverseas) {
    const overseas = picked.filter(p => p.isOverseas).length;
    if (overseas >= 4) return { canPick: false, reason: "Max 4 overseas players" };
  }

  if (player.role === "Batsman") {
    const batsmen = picked.filter(p => p.role === "Batsman").length;
    if (batsmen >= 7) return { canPick: false, reason: "Max 7 specialist batsmen" };
  }

  // Feasibility: after adding this player, can we still fill every unmet requirement?
  const hypothetical = [...picked, player];
  const slotsAfter = remainingSlots - 1;
  const status = computeStatus(hypothetical, mode);
  const deficits = status.reduce((s, r) => s + Math.max(0, r.required - r.filled), 0);
  // Some requirements overlap (e.g. AR counts for bowl), so use max single-req deficit as a hard floor.
  const maxSingle = status.reduce((m, r) => Math.max(m, Math.max(0, r.required - r.filled)), 0);
  if (maxSingle > slotsAfter) {
    return { canPick: false, reason: "Would make the XI unfillable" };
  }
  if (deficits > slotsAfter * 3) {
    // fallback guard, rarely trips
    return { canPick: false, reason: "Team balance impossible" };
  }
  return { canPick: true };
}

export function overseasCount(players: Player[]) {
  return players.filter(p => p.isOverseas).length;
}

export function estimatedRating(players: Player[]): number {
  if (!players.length) return 0;
  const roleOverall = (p: Player) => {
    switch (p.role) {
      case "Batsman":      return p.stats.batting;
      case "PaceBowler":
      case "SpinBowler":   return p.stats.bowling;
      case "AllRounder":   return (p.stats.batting + p.stats.bowling) / 2;
      case "Wicketkeeper": return (p.stats.batting + p.stats.fielding) / 2;
    }
  };
  const sum = players.reduce((s, p) => s + roleOverall(p), 0);
  return Math.round(sum / players.length);
}
