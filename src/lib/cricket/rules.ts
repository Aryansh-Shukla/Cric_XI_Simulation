import type { Player, GameMode } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  summary: {
    wicketkeepers: number;
    bowlers: number;
    pace: number;
    spin: number;
    specialistBatsmen: number;
    overseas: number;
  };
}

export function validateTeam(players: Player[], mode: GameMode): ValidationResult {
  const errors: string[] = [];
  const wk = players.filter(p => p.role === "Wicketkeeper").length;
  const pace = players.filter(p => p.role === "PaceBowler").length;
  const spin = players.filter(p => p.role === "SpinBowler").length;
  const allR = players.filter(p => p.role === "AllRounder").length;
  const bowlers = pace + spin + allR;
  const batsmen = players.filter(p => p.role === "Batsman").length;
  const overseas = players.filter(p => p.isOverseas).length;

  if (players.length !== 11) errors.push(`Team must have exactly 11 players (currently ${players.length}).`);
  if (wk < 1) errors.push("Need at least 1 Wicketkeeper.");
  if (bowlers < 5) errors.push(`Need at least 5 bowling options (currently ${bowlers}).`);
  if (pace < 2) errors.push(`Need at least 2 pace bowlers (currently ${pace}).`);
  if (spin < 1) errors.push("Need at least 1 spinner.");
  if (batsmen > 7) errors.push(`Maximum 7 specialist batsmen (currently ${batsmen}).`);
  if (mode === "FRANCHISE_T20" && overseas > 4) {
    errors.push(`Maximum 4 overseas players in Franchise mode (currently ${overseas}).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: { wicketkeepers: wk, bowlers, pace, spin, specialistBatsmen: batsmen, overseas },
  };
}

export function pickCaptain(players: Player[]): Player {
  const explicit = players.find(p => p.isCaptain);
  if (explicit) return explicit;
  return [...players].sort((a, b) => b.stats.leadership - a.stats.leadership)[0];
}

export function pickViceCaptain(players: Player[], captain: Player): Player {
  return [...players]
    .filter(p => p.id !== captain.id)
    .sort((a, b) => b.stats.leadership - a.stats.leadership)[0];
}