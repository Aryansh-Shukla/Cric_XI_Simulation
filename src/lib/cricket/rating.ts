import type { Player } from "./types";

export function overall(p: Player): number {
  const s = p.stats;
  const battingWeight =
    p.role === "Batsman" || p.role === "Wicketkeeper"
      ? 0.55
      : p.role === "AllRounder"
        ? 0.35
        : 0.15;
  const bowlingWeight =
    p.role === "PaceBowler" || p.role === "SpinBowler"
      ? 0.55
      : p.role === "AllRounder"
        ? 0.35
        : 0.1;
  const other = 1 - battingWeight - bowlingWeight;
  const utility =
    s.fielding * 0.35 +
    s.pressure * 0.25 +
    s.consistency * 0.2 +
    s.fitness * 0.1 +
    s.leadership * 0.1;
  return Math.round(s.batting * battingWeight + s.bowling * bowlingWeight + utility * other);
}

export interface TeamRating {
  overall: number; // 0-100
  batting: number;
  bowling: number;
  fielding: number;
  chemistry: number; // raw bonus applied to overall
  balance: number; // 0-100 penalty-adjusted
}

export function computeTeamRating(players: Player[]): TeamRating {
  if (!players.length) {
    return { overall: 60, batting: 60, bowling: 60, fielding: 60, chemistry: 0, balance: 60 };
  }
  const avg = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const batters = players.filter(
    (p) => p.role === "Batsman" || p.role === "Wicketkeeper" || p.role === "AllRounder",
  );
  const bowlers = players.filter(
    (p) => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder",
  );
  const batting = Math.round(avg(batters.length ? batters.map((p) => p.stats.batting) : [50]));
  const bowling = Math.round(avg(bowlers.length ? bowlers.map((p) => p.stats.bowling) : [50]));
  const fielding = Math.round(avg(players.map((p) => p.stats.fielding)));
  const wks = players.filter((p) => p.role === "Wicketkeeper").length;
  const paceCount = players.filter((p) => p.role === "PaceBowler").length;
  const spinCount = players.filter((p) => p.role === "SpinBowler").length;
  let balancePenalty = 0;
  if (wks === 0) balancePenalty += 8;
  if (paceCount < 2) balancePenalty += 5;
  if (spinCount < 1) balancePenalty += 4;
  const balance = Math.max(0, Math.round((batting + bowling + fielding) / 3 - balancePenalty));
  const overallVal = Math.round(batting * 0.42 + bowling * 0.42 + fielding * 0.08 + balance * 0.08);
  return { overall: overallVal, batting, bowling, fielding, chemistry: 0, balance };
}
