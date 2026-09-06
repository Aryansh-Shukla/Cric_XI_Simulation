import type { GameMode, Player } from "./types";
import { CHEMISTRY } from "./data";
import { traitIdsOf, type TraitId } from "./traits";
import { computeTeamRating } from "./rating";

/* ------------------------------------------------------------------ *
 * Team chemistry & balance.
 *
 * Both are computed purely from the drafted XI (plus leadership picks)
 * and feed small modifiers into the simulation.
 * ------------------------------------------------------------------ */

export interface TeamLeadership {
  captainId?: string;
  viceCaptainId?: string;
  keeperId?: string;
}

export type BalanceLabel = "Strong" | "Good" | "Unbalanced";

export interface TeamBalance {
  score: number; // 0..100
  label: BalanceLabel;
  strengths: string[];
  weaknesses: string[];
}

export interface TeamChemistry {
  score: number; // 0..100
  summary: string;
  /** Named historical partnerships that fired. */
  links: { label: string; pair: string }[];
  balance: TeamBalance;
  /** Captain/vice leadership influence, 0..100. */
  leadership: number;
}

const countBy = (players: Player[], fn: (p: Player) => boolean) => players.filter(fn).length;

function traitCount(players: Player[], id: TraitId) {
  return players.filter((p) => traitIdsOf(p).includes(id)).length;
}

export function computeBalance(players: Player[], mode: GameMode): TeamBalance {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (!players.length) {
    return { score: 60, label: "Good", strengths, weaknesses };
  }

  const sorted = [...players].sort((a, b) => b.stats.batting - a.stats.batting);
  const topOrder = sorted.slice(0, 3);
  const keepers = countBy(players, (p) => p.role === "Wicketkeeper");
  const pace = countBy(players, (p) => p.role === "PaceBowler");
  const spin = countBy(players, (p) => p.role === "SpinBowler");
  const allR = countBy(players, (p) => p.role === "AllRounder");
  const bowlingDepth = pace + spin + allR;
  const batDepth = countBy(players, (p) => p.stats.batting >= 65);
  const finishers = traitCount(players, "finisher");

  let score = 62;

  const topAvg = topOrder.reduce((s, p) => s + p.stats.batting, 0) / (topOrder.length || 1);
  if (topAvg >= 88) {
    score += 9;
    strengths.push("Elite top order");
  } else if (topAvg >= 80) {
    score += 5;
    strengths.push("Reliable top order");
  } else if (topAvg < 70) {
    score -= 6;
    weaknesses.push("Light top order");
  }

  if (batDepth >= 8) {
    score += 6;
    strengths.push("Deep batting line-up");
  } else if (batDepth <= 5) {
    score -= 5;
    weaknesses.push("Long tail");
  }

  if (pace >= 3) {
    score += 6;
    strengths.push("Deep pace attack");
  } else if (pace <= 1) {
    score -= 7;
    weaknesses.push("Thin pace attack");
  }

  if (spin >= 2) {
    score += 5;
    strengths.push("Varied spin options");
  } else if (spin === 0) {
    score -= 7;
    weaknesses.push("No frontline spin");
  }

  if (allR >= 3) {
    score += 6;
    strengths.push("Excellent all-round balance");
  } else if (allR === 0) {
    score -= 4;
    weaknesses.push("No all-round cover");
  }

  if (bowlingDepth >= 6) {
    score += 4;
    strengths.push("Six bowling options");
  } else if (bowlingDepth < 5) {
    score -= 8;
    weaknesses.push("Short of bowling options");
  }

  if (keepers === 0) {
    score -= 10;
    weaknesses.push("No specialist wicketkeeper");
  } else {
    score += 2;
  }

  if (finishers >= 2) {
    score += 4;
    strengths.push("Proven finishers");
  } else if (finishers === 0) {
    weaknesses.push("Limited death-overs hitting");
  }

  if (mode === "FRANCHISE_T20") {
    const overseas = countBy(players, (p) => Boolean(p.isOverseas));
    if (overseas > 4) {
      score -= 8;
      weaknesses.push("Overseas quota exceeded");
    }
  }

  score = Math.max(20, Math.min(100, Math.round(score)));
  const label: BalanceLabel = score >= 80 ? "Strong" : score >= 62 ? "Good" : "Unbalanced";
  return { score, label, strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 3) };
}

/** Named historical partnerships present in the XI. */
export function activatedLinks(players: Player[]) {
  const names = new Set(players.map((p) => p.name));
  return CHEMISTRY.filter((l) => names.has(l.a) && names.has(l.b)).map((l) => ({
    label: l.label,
    pair: `${l.a} × ${l.b}`,
  }));
}

export function computeChemistry(
  players: Player[],
  mode: GameMode,
  leadership?: TeamLeadership | null,
): TeamChemistry {
  const balance = computeBalance(players, mode);
  const links = activatedLinks(players);

  const captain =
    (leadership?.captainId && players.find((p) => p.id === leadership.captainId)) ||
    [...players].sort((a, b) => b.stats.leadership - a.stats.leadership)[0];
  const vice =
    (leadership?.viceCaptainId && players.find((p) => p.id === leadership.viceCaptainId)) ||
    [...players]
      .filter((p) => p.id !== captain?.id)
      .sort((a, b) => b.stats.leadership - a.stats.leadership)[0];

  const capLead = captain?.stats.leadership ?? 60;
  const viceLead = vice?.stats.leadership ?? 55;
  const captainTraits = captain ? traitIdsOf(captain) : [];
  const leaderBonus =
    (captainTraits.includes("great_captain") ? 4 : 0) +
    (captainTraits.includes("tactical_captain") ? 3 : 0) +
    (captainTraits.includes("calm_leader") ? 2 : 0);
  const leadership100 = Math.max(
    0,
    Math.min(100, Math.round(capLead * 0.75 + viceLead * 0.25 + leaderBonus)),
  );

  // Same-squad familiarity: players drafted from the same historical squad
  // (profile ids are prefixed with the squad id) know each other's game.
  const squadOf = (p: Player) => (p.id.includes("::") ? p.id.split("::")[0] : p.country);
  const groups = new Map<string, number>();
  for (const p of players) groups.set(squadOf(p), (groups.get(squadOf(p)) ?? 0) + 1);
  const familiarity = [...groups.values()].reduce((s, n) => s + (n > 1 ? (n - 1) * 1.4 : 0), 0);

  // Complementary traits: a spread of phase specialists beats eleven of a kind.
  const buckets: TraitId[] = [
    "powerplay_specialist",
    "anchor",
    "finisher",
    "new_ball_specialist",
    "middle_overs_specialist",
    "death_specialist",
  ];
  const covered = buckets.filter((b) => traitCount(players, b) > 0).length;

  const rating = computeTeamRating(players);
  const raw =
    balance.score * 0.42 +
    leadership100 * 0.18 +
    rating.fielding * 0.12 +
    Math.min(12, familiarity) +
    covered * 2.2 +
    Math.min(9, links.length * 3);

  const score = Math.max(25, Math.min(100, Math.round(raw)));

  const summary = buildSummary(balance, links.length, leadership100);
  return { score, summary, links, balance, leadership: leadership100 };
}

function buildSummary(balance: TeamBalance, linkCount: number, leadership: number): string {
  const parts: string[] = [];
  if (balance.strengths.length) parts.push(balance.strengths.slice(0, 2).join(" and ").toLowerCase());
  if (leadership >= 80) parts.push("outstanding leadership");
  else if (leadership < 55) parts.push("leadership is a question mark");
  if (linkCount) parts.push(`${linkCount} famous partnership${linkCount === 1 ? "" : "s"} in the XI`);
  const head = parts.length ? `Strong on ${parts.join(", ")}.` : "A workable, unspectacular XI.";
  const tail = balance.weaknesses.length ? ` Watch out: ${balance.weaknesses[0].toLowerCase()}.` : "";
  return head + tail;
}

/** Small, bounded simulation modifiers derived from the XI. */
export interface TeamModifiers {
  chemistry: number; // rating-point swing, roughly -4..+4
  balance: number; // -3..+3
  captaincy: number; // -2..+3
  momentum: number; // -3..+3
}

export const NEUTRAL_MODIFIERS: TeamModifiers = {
  chemistry: 0,
  balance: 0,
  captaincy: 0,
  momentum: 0,
};

export function modifiersFrom(chem: TeamChemistry, momentum = 0): TeamModifiers {
  return {
    chemistry: round1((chem.score - 65) / 9),
    balance: round1((chem.balance.score - 68) / 11),
    captaincy: round1((chem.leadership - 62) / 14),
    momentum: round1(momentum * 3),
  };
}

export function totalModifier(m: TeamModifiers): number {
  const sum = m.chemistry + m.balance + m.captaincy + m.momentum;
  return Math.max(-8, Math.min(8, sum));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
