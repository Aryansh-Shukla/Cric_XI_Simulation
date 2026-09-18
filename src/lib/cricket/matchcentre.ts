import type { BallEvent, LimitedScorecard, TestScorecard, TimelineInnings, Innings } from "./types";

/* ------------------------------------------------------------------ *
 * Match Centre analytics.
 *
 * Every value here is DERIVED from the canonical simulated result — the
 * ball-by-ball timeline attached to the scorecard. Nothing is invented and
 * nothing is re-simulated, so the live view can never disagree with the
 * final scorecard.
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function rate(runs: number, balls: number): number {
  return balls > 0 ? Math.round(((runs * 6) / balls) * 100) / 100 : 0;
}

export interface BatterLive {
  name: string;
  runs: number;
  balls: number;
}
export interface BowlerLive {
  name: string;
  wickets: number;
  runs: number;
  balls: number;
}

export interface LiveSnapshot {
  inningsIndex: number;
  label: string;
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  balls: number;
  ballsRemaining: number;
  overs: string;
  oversRemaining: string;
  currentRunRate: number;
  /** Only defined while a live chase is still running. */
  target?: number;
  runsRequired?: number;
  requiredRunRate?: number;
  striker: BatterLive | null;
  bowler: BowlerLive | null;
  partnership: { runs: number; balls: number; wicket: number };
  phase: string;
  recent: BallEvent[];
  situation: string;
  /** Win probability for the user's team, 0..100. */
  winProbUs: number;
  inningsComplete: boolean;
}

function phaseLabel(p: BallEvent["phase"], format: "T20" | "ODI"): string {
  switch (p) {
    case "PP":
      return "Powerplay";
    case "MID":
      return "Middle overs";
    case "ACCEL":
      return format === "ODI" ? "Acceleration" : "Middle overs";
    case "DEATH":
      return "Death overs";
  }
}

/* ---------- Win probability ---------- */

function parRpb(format: "T20" | "ODI"): number {
  return format === "T20" ? 1.42 : 1.02;
}

/**
 * Chasing side's probability of getting there, from resources remaining.
 * Deliberately smooth: a single dot ball moves it a couple of points at most.
 */
function chaseProbability(
  format: "T20" | "ODI",
  need: number,
  ballsLeft: number,
  wicketsLeft: number,
): number {
  if (need <= 0) return 1;
  if (ballsLeft <= 0 || wicketsLeft <= 0) return 0;
  const resource = clamp(0.42 + 0.058 * wicketsLeft, 0.42, 1);
  const expected = ballsLeft * parRpb(format) * resource;
  const scale = Math.max(7, 4 + ballsLeft * 0.13);
  return clamp(1 / (1 + Math.exp(-(expected - need) / scale)), 0.005, 0.995);
}

/** First-innings read: is the batting side ahead of a par total? */
function firstInningsProbability(
  format: "T20" | "ODI",
  runs: number,
  wickets: number,
  ballsBowled: number,
  maxOvers: number,
): number {
  const ballsLeft = maxOvers * 6 - ballsBowled;
  const resource = clamp(0.42 + 0.058 * (10 - wickets), 0.42, 1);
  const projected = runs + ballsLeft * parRpb(format) * resource;
  const par = format === "T20" ? 165 : 265;
  return clamp(0.5 + (projected - par) / (format === "T20" ? 150 : 260), 0.1, 0.9);
}

/* ---------- Situation ---------- */

function situationText(s: {
  format: "T20" | "ODI";
  chasing: boolean;
  need: number;
  ballsLeft: number;
  wickets: number;
  crr: number;
  rrr: number;
  complete: boolean;
  batFirstTeam: string;
}): string {
  if (s.complete) return "Innings complete";
  if (s.chasing) {
    if (s.need <= 0) return "Target reached";
    if (s.wickets >= 9) return "One wicket from defeat — last pair together";
    if (s.ballsLeft <= 6) return "Final over — every ball matters";
    if (s.rrr - s.crr > 3.5) return "Pressure building — the required rate is climbing";
    if (s.rrr - s.crr > 1.5) return "Chase drifting behind the rate";
    if (s.wickets <= 3 && s.rrr <= s.crr) return "Comfortable position in the chase";
    return "Chasing at around the required rate";
  }
  if (s.wickets >= 7) return "Rebuilding — the tail is exposed";
  if (s.ballsLeft <= 30) return "Final overs — setting up a total";
  if (s.crr > (s.format === "T20" ? 9 : 6.2)) return `${s.batFirstTeam} dominating with the bat`;
  if (s.crr < (s.format === "T20" ? 6 : 4)) return "Bowlers on top — runs hard to come by";
  return "Innings settling into a rhythm";
}

/* ---------- Snapshot ---------- */

/**
 * State of the match after `ballIdx` deliveries of innings `inningsIndex`.
 * `ballIdx` is a count (0 = before the first ball).
 */
export function snapshotAt(
  r: LimitedScorecard,
  inningsIndex: number,
  ballIdx: number,
  momentum = 0,
): LiveSnapshot | null {
  const timeline = r.timeline;
  if (!timeline || !timeline[inningsIndex]) return null;
  const inn = timeline[inningsIndex];
  const shown = inn.balls.slice(0, clamp(ballIdx, 0, inn.balls.length));
  const last = shown[shown.length - 1] ?? null;
  const balls = shown.length;
  const runs = last ? last.score : 0;
  const wickets = last ? last.wickets : 0;
  const maxBalls = inn.maxOvers * 6;
  const inningsComplete = balls >= inn.balls.length;

  const bowlingTeam = inn.teamName === r.ourName ? r.oppName : r.ourName;
  const chasing = inn.target !== undefined;
  const ballsRemaining = Math.max(0, maxBalls - balls);
  const need = chasing ? Math.max(0, inn.target! - runs) : 0;
  const crr = rate(runs, balls);
  const rrr = chasing && ballsRemaining > 0 && need > 0 ? rate(need, ballsRemaining) : 0;

  const chaseLive = chasing && !inningsComplete && need > 0 && ballsRemaining > 0 && wickets < 10;

  const probBatting = chasing
    ? chaseProbability(inn.format, need, ballsRemaining, 10 - wickets)
    : firstInningsProbability(inn.format, runs, wickets, balls, inn.maxOvers);
  let probUs = inn.teamName === r.ourName ? probBatting : 1 - probBatting;
  // Momentum is a mood, not a verdict — at most a couple of points.
  probUs = clamp(probUs + momentum * 0.02, 0.01, 0.99);
  if (inningsComplete && inningsIndex === timeline.length - 1) probUs = r.weWon ? 1 : 0;

  return {
    inningsIndex,
    label: inn.label,
    battingTeam: inn.teamName,
    bowlingTeam,
    runs,
    wickets,
    balls,
    ballsRemaining,
    overs: oversText(balls),
    oversRemaining: oversText(ballsRemaining),
    currentRunRate: crr,
    target: chasing ? inn.target : undefined,
    runsRequired: chaseLive ? need : undefined,
    requiredRunRate: chaseLive ? rrr : undefined,
    striker: last ? { name: last.batter, runs: last.batterRuns, balls: last.batterBalls } : null,
    bowler: last
      ? {
          name: last.bowler,
          wickets: last.bowlerWickets,
          runs: last.bowlerRuns,
          balls: last.bowlerBalls,
        }
      : null,
    partnership: last
      ? {
          runs: last.wicket ? 0 : last.partnershipRuns,
          balls: last.wicket ? 0 : last.partnershipBalls,
          wicket: last.wicket ? last.partnershipWicket + 1 : last.partnershipWicket,
        }
      : { runs: 0, balls: 0, wicket: 1 },
    phase: last ? phaseLabel(last.phase, inn.format) : "Powerplay",
    recent: shown.slice(-6).reverse(),
    situation: situationText({
      format: inn.format,
      chasing,
      need,
      ballsLeft: ballsRemaining,
      wickets,
      crr,
      rrr,
      complete: inningsComplete,
      batFirstTeam: inn.teamName,
    }),
    winProbUs: Math.round(probUs * 100),
    inningsComplete,
  };
}

/* ---------- Ball commentary ---------- */

function variant<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * One line of commentary for one delivery. Grounded strictly in what the ball
 * actually was; the surrounding state only colours the wording.
 */
export function ballCommentary(e: BallEvent, inn: TimelineInnings, chasingNeed?: number): string {
  // Deterministic per delivery, but varied enough that repeated outcomes in a
  // single over do not read as the same sentence twice.
  const nameSeed = e.batter.length * 5 + e.bowler.length * 3 + e.batterBalls;
  const seed = e.over * 7 + e.ball * 3 + e.runs + nameSeed;
  const death = e.phase === "DEATH";
  const pp = e.phase === "PP";
  if (e.wicket) {
    const how = e.dismissal ? ` (${e.dismissal})` : "";
    return variant(
      [
        `WICKET! ${e.bowler} gets ${e.batter}${how} for ${e.batterRuns}.`,
        `Gone! ${e.batter} departs for ${e.batterRuns}${how} — ${e.bowler} strikes.`,
        `${e.bowler} breaks through${how}. ${e.batter} falls for ${e.batterRuns}.`,
      ],
      seed,
    );
  }
  if (e.runs === 6) {
    return variant(
      [
        `SIX! ${e.batter} clears the ropes off ${e.bowler}.`,
        `Maximum — ${e.batter} launches ${e.bowler} into the crowd.`,
        death
          ? `Huge six at the death, ${e.batter} finding the range.`
          : `${e.batter} goes big and it sails over the boundary.`,
      ],
      seed,
    );
  }
  if (e.runs === 4) {
    return variant(
      [
        `FOUR! ${e.batter} finds the fence off ${e.bowler}.`,
        pp
          ? `Beautifully timed boundary inside the powerplay by ${e.batter}.`
          : `${e.batter} pierces the field for four.`,
        `Four more — ${e.batter} punishes ${e.bowler}.`,
      ],
      seed,
    );
  }
  if (e.runs === 0) {
    const pressure =
      chasingNeed !== undefined && chasingNeed > 0
        ? variant(
            [
              `Dot ball — ${e.bowler} squeezes, ${chasingNeed} still needed.`,
              `No run. The required rate ticks up on ${e.batter}.`,
            ],
            seed,
          )
        : null;
    return (
      pressure ??
      variant([`Dot ball, ${e.bowler} on the money.`, `${e.batter} defends, no run.`], seed)
    );
  }
  return variant(
    [
      `${e.runs} run${e.runs === 1 ? "" : "s"} for ${e.batter}.`,
      `Worked away for ${e.runs} — ${inn.teamName} ${e.score}/${e.wickets}.`,
    ],
    seed,
  );
}

/* ---------- Milestones ---------- */

export type MilestoneKind = "batter" | "bowler" | "team" | "partnership" | "match";
export interface Milestone {
  kind: MilestoneKind;
  text: string;
}

const TEAM_MARKS = [50, 100, 150, 200, 250, 300];

/** Milestones genuinely reached ON this delivery. */
export function milestonesAt(inn: TimelineInnings, index: number): Milestone[] {
  const e = inn.balls[index];
  if (!e) return [];
  const prev = index > 0 ? inn.balls[index - 1] : null;
  const out: Milestone[] = [];
  const before = e.wicket ? e.batterRuns : e.batterRuns - e.runs;

  if (!e.wicket) {
    if (before < 50 && e.batterRuns >= 50 && e.batterRuns < 100)
      out.push({ kind: "batter", text: `FIFTY — ${e.batter} off ${e.batterBalls} balls` });
    if (before < 100 && e.batterRuns >= 100)
      out.push({ kind: "batter", text: `HUNDRED — ${e.batter} off ${e.batterBalls} balls` });
  }
  if (e.wicket) {
    if (e.bowlerWickets === 3) out.push({ kind: "bowler", text: `${e.bowler} has three wickets` });
    if (e.bowlerWickets === 5)
      out.push({
        kind: "bowler",
        text: `FIVE-FOR — ${e.bowler} ${e.bowlerWickets}/${e.bowlerRuns}`,
      });
  }
  const prevScore = prev ? prev.score : 0;
  for (const m of TEAM_MARKS) {
    if (prevScore < m && e.score >= m)
      out.push({ kind: "team", text: `${inn.teamName} up to ${m}` });
  }
  if (!e.wicket) {
    const pBefore = e.partnershipRuns - e.runs;
    if (pBefore < 50 && e.partnershipRuns >= 50 && e.partnershipRuns < 100)
      out.push({
        kind: "partnership",
        text: `50-run stand for the ${ordinal(e.partnershipWicket)} wicket`,
      });
    if (pBefore < 100 && e.partnershipRuns >= 100)
      out.push({
        kind: "partnership",
        text: `100-run stand for the ${ordinal(e.partnershipWicket)} wicket`,
      });
  }
  const ballsBowled = index + 1;
  if (ballsBowled === (inn.maxOvers - 1) * 6 + 1) out.push({ kind: "match", text: "Final over" });
  if (inn.target !== undefined) {
    const need = inn.target - e.score;
    const ballsLeft = inn.maxOvers * 6 - ballsBowled;
    if (need > 0 && need <= 12 && ballsLeft <= 6)
      out.push({ kind: "match", text: `${need} needed off ${ballsLeft}` });
    if (need <= 0) out.push({ kind: "match", text: `${inn.teamName} complete the chase` });
  }
  return out;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* ---------- Tests ---------- */

export interface TestInningsCard {
  label: string;
  teamName: string;
  isOurs: boolean;
  runs: number;
  wickets: number;
  overs: number;
  declared: boolean;
  followOn: boolean;
  /** Lead (+) or deficit (-) for the batting side at the end of this innings. */
  leadAfter: number;
  /** Runs still required when this innings is a fourth-innings chase. */
  target?: number;
  note: string;
}

/**
 * Chronological innings view of a Test, with running lead/deficit — the
 * multi-innings equivalent of the limited-overs live panel.
 */
export function testProgress(r: TestScorecard): TestInningsCard[] {
  const weBattedFirst =
    (r.toss.winner === "us" && r.toss.decision === "bat") ||
    (r.toss.winner === "opp" && r.toss.decision === "bowl");

  type Entry = { inn: Innings; isOurs: boolean; idx: number };
  const ours: Entry[] = r.ourInnings.map((inn, idx) => ({ inn, isOurs: true, idx }));
  const opp: Entry[] = r.oppInnings.map((inn, idx) => ({ inn, isOurs: false, idx }));

  const order: Entry[] = [];
  const first = weBattedFirst ? ours : opp;
  const second = weBattedFirst ? opp : ours;
  if (first[0]) order.push(first[0]);
  if (second[0]) order.push(second[0]);
  // Follow-on means the side that batted second bats again immediately.
  if (second[1]?.inn.followOn) {
    order.push(second[1]);
    if (first[1]) order.push(first[1]);
  } else {
    if (first[1]) order.push(first[1]);
    if (second[1]) order.push(second[1]);
  }

  let ourTotal = 0;
  let oppTotal = 0;
  return order.map((e, i) => {
    if (e.isOurs) ourTotal += e.inn.runs;
    else oppTotal += e.inn.runs;
    const leadAfter = e.isOurs ? ourTotal - oppTotal : oppTotal - ourTotal;
    // The last innings of the match is a chase whenever the side started it behind.
    const leadBefore = leadAfter - e.inn.runs;
    const target = i === order.length - 1 && leadBefore < 0 ? -leadBefore + 1 : undefined;
    const note = e.inn.declared
      ? "Declared"
      : e.inn.followOn
        ? "Following on"
        : e.inn.wickets >= 10
          ? "All out"
          : leadAfter > 0
            ? `Lead of ${leadAfter}`
            : `Trail by ${Math.abs(leadAfter)}`;
    return {
      label: `${e.isOurs ? r.ourName : r.oppName} · ${e.idx === 0 ? "1st" : "2nd"} Innings`,
      teamName: e.isOurs ? r.ourName : r.oppName,
      isOurs: e.isOurs,
      runs: e.inn.runs,
      wickets: e.inn.wickets,
      overs: e.inn.overs,
      declared: !!e.inn.declared,
      followOn: !!e.inn.followOn,
      leadAfter,
      target,
      note,
    };
  });
}
