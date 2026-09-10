import type { LimitedScorecard, MatchResult, StageKind, TestScorecard } from "./types";
import { KNOCKOUT_STAGES } from "./types";

/* ------------------------------------------------------------------ *
 * Tournament momentum & contextual pressure.
 *
 * Both are small contextual modifiers derived from completed matches and
 * the situation of the next fixture. Neither is a player rating and
 * neither is allowed to dominate team quality.
 * ------------------------------------------------------------------ */

export type MomentumLabel = "Rising" | "Strong" | "Neutral" | "Slipping" | "Poor";
export type PressureLabel = "Low" | "Moderate" | "High" | "Extreme";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Runs margin implied by a limited-overs result, from the user's point of view. */
function marginWeight(r: LimitedScorecard): number {
  const ours = r.ourInnings.runs;
  const theirs = r.oppInnings.runs;
  const diff = Math.abs(ours - theirs);
  if (r.superOver) return 0.4; // decided on the thinnest of margins
  const scale = r.format === "T20" ? 30 : 55;
  return clamp(diff / scale, 0.35, 1.3);
}

/**
 * New momentum after a completed match. Deterministic: derived only from the
 * result, never from random values, and never mutated during render.
 */
export function nextMomentum(prev: number, r: MatchResult): number {
  const decay = prev * 0.68;
  const knockout = (KNOCKOUT_STAGES as string[]).includes(r.stage);

  if (!("weWon" in r)) {
    const t = r as TestScorecard;
    const delta = t.result === "WON" ? 0.3 : t.result === "LOST" ? -0.3 : 0.02;
    return clamp(decay + delta, -1, 1);
  }

  const lim = r as LimitedScorecard;
  const weight = marginWeight(lim);
  let delta = (lim.weWon ? 0.26 : -0.26) * weight;
  if (knockout) delta *= 1.25; // knockout results swing the mood harder
  // A win after a bad run (comeback) counts for a little extra.
  if (lim.weWon && prev < -0.2) delta += 0.08;
  return clamp(decay + delta, -1, 1);
}

export function momentumLabel(m: number): MomentumLabel {
  if (m >= 0.55) return "Rising";
  if (m >= 0.2) return "Strong";
  if (m > -0.2) return "Neutral";
  if (m > -0.55) return "Slipping";
  return "Poor";
}

export interface PressureInput {
  stage: StageKind;
  /** True when losing this fixture ends the campaign. */
  mustWin: boolean;
  /** Momentum going in — a bad run adds to the occasion. */
  momentum: number;
}

/** Baseline pressure for the next fixture, 0 (routine) .. 1 (last over of a final). */
export function fixturePressure(input: PressureInput): number {
  const { stage, mustWin, momentum } = input;
  let p: number;
  switch (stage) {
    case "Final":
      p = 0.8;
      break;
    case "Semi Final":
    case "Qualifier 1":
      p = 0.62;
      break;
    case "Qualifier 2":
    case "Eliminator":
    case "Quarter Final":
      p = 0.66;
      break;
    case "Super 8":
      p = 0.34;
      break;
    case "Test 3":
      p = 0.4;
      break;
    default:
      p = 0.2;
  }
  if (mustWin) p += 0.15;
  if (momentum < -0.3) p += 0.08;
  if (momentum > 0.4) p -= 0.05;
  return clamp(Math.round(p * 100) / 100, 0, 1);
}

export function pressureLabel(p: number): PressureLabel {
  if (p >= 0.72) return "Extreme";
  if (p >= 0.45) return "High";
  if (p >= 0.25) return "Moderate";
  return "Low";
}
