import type {
  Player,
  Pitch,
  Weather,
  Innings,
  LimitedScorecard,
  StageKind,
  GameMode,
  FullInnings,
  SuperOver,
} from "../types";
import { KNOCKOUT_STAGES } from "../types";
import { attrs, battingOrder, bowlingPool, wicketkeeper } from "./attributes";
import { clamp, pick, Rng, weightedPick } from "./rng";

/* ---------- Types ---------- */

export type Format = "T20" | "ODI";
export type Phase = "PP" | "MID" | "ACCEL" | "DEATH";

interface BatterState {
  p: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: { how: string; bowler?: Player; fielder?: Player };
}
interface BowlerState {
  p: Player;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
}
export interface MatchEvent {
  over: number;
  ball: number;
  batter: Player;
  bowler: Player;
  runs: number;
  wicket: boolean;
  dismissal?: string;
  desc: string;
  phase: Phase;
}
export interface InningsState {
  teamName: string;
  runs: number;
  wickets: number;
  balls: number;
  batters: BatterState[];
  bowlers: Map<string, BowlerState>;
  partnerships: { a: string; b: string; runs: number; balls: number }[];
  fallOfWickets: { runs: number; wicket: number; batter: string; over: number }[];
  events: MatchEvent[];
  target?: number;
  chased: boolean;
  format: Format;
}

/* ---------- Phase / era model ---------- */

function phaseFor(format: Format, over: number): { phase: Phase; rpo: number; wkt: number } {
  if (format === "T20") {
    if (over < 6) return { phase: "PP", rpo: 7.6, wkt: 0.038 };
    if (over < 15) return { phase: "MID", rpo: 7.4, wkt: 0.028 };
    return { phase: "DEATH", rpo: 10.6, wkt: 0.062 };
  }
  if (over < 10) return { phase: "PP", rpo: 5.2, wkt: 0.024 };
  if (over < 30) return { phase: "MID", rpo: 5.4, wkt: 0.02 };
  if (over < 40) return { phase: "ACCEL", rpo: 7.0, wkt: 0.028 };
  return { phase: "DEATH", rpo: 9.4, wkt: 0.05 };
}

export function eraMultiplier(year: number, mode: GameMode): number {
  if (mode === "T20_WC" || mode === "FRANCHISE_T20") {
    if (year < 2010) return 0.9;
    if (year < 2016) return 0.97;
    return 1.03;
  }
  if (mode === "ODI_WC" || mode === "CHAMPIONS") {
    if (year < 1985) return 0.72;
    if (year < 2000) return 0.85;
    if (year < 2011) return 0.95;
    return 1.05;
  }
  return year < 1990 ? 0.9 : 1.0;
}

function pitchFactors(pitch: Pitch) {
  switch (pitch) {
    case "Flat":
      return { bat: 1.1, wkt: 0.82 };
    case "Green":
      return { bat: 0.9, wkt: 1.25 };
    case "Dusty":
      return { bat: 0.95, wkt: 1.1 };
    case "Turning":
      return { bat: 0.93, wkt: 1.18 };
    case "Slow":
      return { bat: 0.92, wkt: 1.05 };
  }
}

function weatherFactors(w: Weather) {
  switch (w) {
    case "Sunny":
      return { bat: 1.02, wkt: 0.98 };
    case "Cloudy":
      return { bat: 0.96, wkt: 1.08 };
    case "Humid":
      return { bat: 0.98, wkt: 1.05 };
    case "Night Match":
      return { bat: 1.03, wkt: 0.95 }; // dew helps batting/chasing
  }
}

/* ---------- Ball outcome ---------- */

function skillFor(a: ReturnType<typeof attrs>, phase: Phase, side: "bat" | "bowl") {
  if (side === "bat") {
    if (phase === "PP") return a.ppBat;
    if (phase === "DEATH") return a.deathBat;
    return a.midBat;
  }
  if (phase === "PP") return a.ppBowl;
  if (phase === "DEATH") return a.deathBowl;
  return a.midBowl;
}

interface OutcomeCtx {
  format: Format;
  over: number;
  pitch: Pitch;
  weather: Weather;
  era: number;
  target?: number;
  currentRuns: number;
  ballsLeft: number;
  wicketsDown: number;
  fielding: number; // 0..100 avg
  chemistryBonus: number;
}

function ballOutcome(
  bat: BatterState,
  bwl: BowlerState,
  ctx: OutcomeCtx,
  rng: Rng,
): { runs: number; wicket: boolean; dismissal?: string } {
  const ph = phaseFor(ctx.format, ctx.over);
  const bA = attrs(bat.p);
  const wA = attrs(bwl.p);
  const bSkill = skillFor(bA, ph.phase, "bat");
  const wSkill = skillFor(wA, ph.phase, "bowl");
  const skillFactor = 1 + (bSkill - wSkill + ctx.chemistryBonus * 0.4) / 220;

  const pf = pitchFactors(ctx.pitch);
  const wf = weatherFactors(ctx.weather);

  // Chasing pressure: shifts aggression + wicket risk
  let chaseFactor = 1;
  if (ctx.target !== undefined && ctx.ballsLeft > 0) {
    const needed = Math.max(0, ctx.target - ctx.currentRuns);
    const reqRpb = needed / ctx.ballsLeft;
    const parRpb = ph.rpo / 6;
    chaseFactor = clamp(1 + (reqRpb - parRpb) * 1.6, 0.7, 1.9);
  }

  // Wicket-pressure: fewer wickets in hand -> more conservative in ODI/Test-like phases
  const wicketBrake = ctx.wicketsDown >= 7 && ctx.format === "ODI" ? 0.85 : 1;

  const rpo = ph.rpo * skillFactor * pf.bat * wf.bat * ctx.era * chaseFactor * wicketBrake;
  const meanRpb = clamp(rpo / 6, 0.35, 3.2);

  let pWkt =
    (ph.wkt / Math.max(0.75, skillFactor)) *
    pf.wkt *
    wf.wkt *
    (chaseFactor > 1.3 ? 1.35 : 1) *
    (0.9 + (100 - ctx.fielding) / 500);
  pWkt = clamp(pWkt, 0.005, 0.28);

  if (rng() < pWkt) {
    const roll = rng();
    const dismissal =
      roll < 0.32
        ? "c"
        : roll < 0.55
          ? "b"
          : roll < 0.72
            ? "lbw"
            : roll < 0.88
              ? "c wk"
              : roll < 0.95
                ? "run out"
                : wA.isSpin
                  ? "st"
                  : "c&b";
    return { runs: 0, wicket: true, dismissal };
  }

  // Build outcome distribution around meanRpb
  const p6 = clamp(
    0.02 +
      (meanRpb - 0.8) * 0.11 +
      (bA.hasTrait("Powerplay Destroyer") && ph.phase === "PP" ? 0.03 : 0),
    0.005,
    0.2,
  );
  const p4 = clamp(0.08 + (meanRpb - 0.8) * 0.14, 0.03, 0.24);
  const p2 = 0.06;
  const p3 = 0.008;
  const boundaryMean = 6 * p6 + 4 * p4 + 2 * p2 + 3 * p3;
  const p1 = clamp(meanRpb - boundaryMean, 0.05, 0.55);
  const p0 = clamp(1 - (p6 + p4 + p2 + p3 + p1), 0.05, 0.9);

  const r = rng();
  let cum = p0;
  if (r < cum) return { runs: 0, wicket: false };
  cum += p1;
  if (r < cum) return { runs: 1, wicket: false };
  cum += p2;
  if (r < cum) return { runs: 2, wicket: false };
  cum += p3;
  if (r < cum) return { runs: 3, wicket: false };
  cum += p4;
  if (r < cum) return { runs: 4, wicket: false };
  return { runs: 6, wicket: false };
}

/* ---------- Bowling selection ---------- */

function pickBowler(
  bowlers: Player[],
  states: Map<string, BowlerState>,
  lastBowlerId: string | null,
  over: number,
  format: Format,
  rng: Rng,
): Player {
  const maxBalls = (format === "T20" ? 4 : 10) * 6;
  const ph = phaseFor(format, over).phase;
  const eligible = bowlers.filter((b) => {
    const st = states.get(b.id)!;
    return st.balls < maxBalls && b.id !== lastBowlerId;
  });
  if (!eligible.length) {
    // last resort: allow back-to-back (shouldn't happen in a legal match; fall back to any with balls left)
    const any = bowlers.filter((b) => states.get(b.id)!.balls < maxBalls);
    return any[0] ?? bowlers[0];
  }
  const weights = eligible.map((b) => {
    const a = attrs(b);
    const skill = skillFor(a, ph, "bowl");
    const remaining = maxBalls - states.get(b.id)!.balls;
    return Math.pow(Math.max(1, skill), 3) * (remaining / maxBalls + 0.35);
  });
  return weightedPick(eligible, weights, rng);
}

/* ---------- Innings simulation ---------- */

export interface SimContext {
  format: Format;
  pitch: Pitch;
  weather: Weather;
  era: number;
  chemistryBonus: number;
}

export function simulateInnings(
  teamName: string,
  batting: Player[],
  bowling: Player[],
  ctx: SimContext,
  rng: Rng,
  target?: number,
): InningsState {
  const maxOvers = ctx.format === "T20" ? 20 : 50;
  const order = battingOrder(batting);
  const bowlers = bowlingPool(bowling);
  const fielding = bowling.reduce((s, p) => s + p.stats.fielding, 0) / bowling.length;

  const batters: BatterState[] = order.map((p) => ({
    p,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  }));
  const bowlerStates = new Map<string, BowlerState>();
  for (const b of bowlers)
    bowlerStates.set(b.id, { p: b, balls: 0, runs: 0, wickets: 0, maidens: 0 });

  let striker = 0,
    nonStriker = 1,
    nextBat = 2;
  let runs = 0,
    wickets = 0,
    balls = 0;
  const events: MatchEvent[] = [];
  const fall: InningsState["fallOfWickets"] = [];
  const partnerships: InningsState["partnerships"] = [];
  let curPart = { a: batters[0].p.name, b: batters[1].p.name, runs: 0, balls: 0 };
  let lastBowlerId: string | null = null;
  let chased = false;

  outer: for (let over = 0; over < maxOvers; over++) {
    const bowler = pickBowler(bowlers, bowlerStates, lastBowlerId, over, ctx.format, rng);
    lastBowlerId = bowler.id;
    const bwState = bowlerStates.get(bowler.id)!;
    let overRuns = 0;

    for (let bn = 0; bn < 6; bn++) {
      if (wickets >= 10) break outer;
      if (target !== undefined && runs >= target) {
        chased = true;
        break outer;
      }

      const batState = batters[striker];
      const ballsLeft = maxOvers * 6 - balls;
      const out = ballOutcome(
        batState,
        bwState,
        {
          format: ctx.format,
          over,
          pitch: ctx.pitch,
          weather: ctx.weather,
          era: ctx.era,
          target,
          currentRuns: runs,
          ballsLeft,
          wicketsDown: wickets,
          fielding,
          chemistryBonus: ctx.chemistryBonus,
        },
        rng,
      );

      balls++;
      batState.balls++;
      bwState.balls++;
      const phase = phaseFor(ctx.format, over).phase;

      if (out.wicket) {
        wickets++;
        batState.out = true;
        batState.dismissal = { how: out.dismissal!, bowler: bwState.p };
        bwState.wickets++;
        fall.push({ runs, wicket: wickets, batter: batState.p.name, over });
        partnerships.push({ ...curPart, balls: curPart.balls + 1 });
        if (nextBat < batters.length) {
          striker = nextBat;
          nextBat++;
          curPart = {
            a: batters[striker].p.name,
            b: batters[nonStriker].p.name,
            runs: 0,
            balls: 0,
          };
        }
        events.push({
          over,
          ball: bn + 1,
          batter: batState.p,
          bowler: bwState.p,
          runs: 0,
          wicket: true,
          dismissal: out.dismissal,
          phase,
          desc: "",
        });
      } else {
        runs += out.runs;
        bwState.runs += out.runs;
        batState.runs += out.runs;
        overRuns += out.runs;
        if (out.runs === 4) batState.fours++;
        if (out.runs === 6) batState.sixes++;
        curPart.runs += out.runs;
        curPart.balls++;
        events.push({
          over,
          ball: bn + 1,
          batter: batState.p,
          bowler: bwState.p,
          runs: out.runs,
          wicket: false,
          phase,
          desc: "",
        });
        if (out.runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
      }
    }
    // end of over: swap ends
    [striker, nonStriker] = [nonStriker, striker];
    if (overRuns === 0 && bwState.balls >= 6) bwState.maidens++;
  }

  if (
    curPart.balls > 0 &&
    (partnerships.length === 0 || partnerships[partnerships.length - 1] !== curPart)
  ) {
    partnerships.push({ ...curPart });
  }

  return {
    teamName,
    runs,
    wickets,
    balls,
    batters,
    bowlers: bowlerStates,
    partnerships,
    fallOfWickets: fall,
    events,
    target,
    chased,
    format: ctx.format,
  };
}

/* ---------- Summarise into Innings ---------- */

function oversFromBalls(balls: number) {
  return Math.floor(balls / 6) + (balls % 6) / 10;
}

export function summariseInnings(s: InningsState): Innings {
  const overs = Math.round(oversFromBalls(s.balls) * 10) / 10;
  const runRate = s.balls > 0 ? Math.round(((s.runs * 6) / s.balls) * 100) / 100 : 0;
  const topBatter =
    [...s.batters].filter((b) => b.balls > 0).sort((a, b) => b.runs - a.runs)[0] ?? s.batters[0];
  const bowlerArr = Array.from(s.bowlers.values()).filter((b) => b.balls > 0);
  const bestBowler = bowlerArr.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0] ?? null;
  const topPart = [...s.partnerships].sort((a, b) => b.runs - a.runs)[0] ?? {
    a: s.batters[0].p.name,
    b: s.batters[1]?.p.name ?? s.batters[0].p.name,
    runs: 0,
    balls: 0,
  };

  return {
    teamName: s.teamName,
    runs: s.runs,
    wickets: s.wickets,
    overs,
    runRate,
    topScorer: { name: topBatter.p.name, runs: topBatter.runs, balls: topBatter.balls },
    bestBowler: bestBowler
      ? {
          name: bestBowler.p.name,
          wickets: bestBowler.wickets,
          runs: bestBowler.runs,
          overs: Math.round(oversFromBalls(bestBowler.balls) * 10) / 10,
        }
      : { name: "—", wickets: 0, runs: 0, overs: 0 },
    partnership: { names: [topPart.a, topPart.b], runs: topPart.runs },
  };
}

/** Convert internal InningsState into a serializable FullInnings for UI/stats. */
export function toFullInnings(s: InningsState, label?: string): FullInnings {
  const overs = Math.round(oversFromBalls(s.balls) * 10) / 10;
  const batters = s.batters
    .filter((b) => b.balls > 0 || b.out)
    .map((b) => ({
      name: b.p.name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      out: b.out,
      how: b.dismissal
        ? `${b.dismissal.how}${b.dismissal.bowler ? " b " + b.dismissal.bowler.name : ""}`
        : b.balls > 0
          ? "not out"
          : undefined,
    }));
  const bowlers = Array.from(s.bowlers.values())
    .filter((b) => b.balls > 0)
    .map((b) => {
      const ov = Math.round(oversFromBalls(b.balls) * 10) / 10;
      const econ = b.balls > 0 ? Math.round(((b.runs * 6) / b.balls) * 100) / 100 : 0;
      return {
        name: b.p.name,
        overs: ov,
        runs: b.runs,
        wickets: b.wickets,
        maidens: b.maidens,
        econ,
      };
    });
  return {
    teamName: s.teamName,
    runs: s.runs,
    wickets: s.wickets,
    overs,
    batters,
    bowlers,
    fall: s.fallOfWickets.map((f) => ({ ...f })),
    label,
  };
}

/* ---------- Toss ---------- */

export function decideToss(
  pitch: Pitch,
  weather: Weather,
  format: Format,
  rng: Rng,
): {
  winner: "us" | "opp";
  decision: "bat" | "bowl";
} {
  const winner: "us" | "opp" = rng() < 0.5 ? "us" : "opp";
  let batBias = 0.5;
  if (pitch === "Flat") batBias += 0.15;
  if (pitch === "Green") batBias -= 0.22;
  if (pitch === "Turning") batBias += 0.05;
  if (weather === "Cloudy") batBias -= 0.1;
  if (weather === "Night Match") batBias -= 0.18; // dew, chase
  if (weather === "Sunny") batBias += 0.05;
  if (format === "T20") batBias -= 0.05;
  const decision: "bat" | "bowl" = rng() < clamp(batBias, 0.15, 0.85) ? "bat" : "bowl";
  return { winner, decision };
}

/* ---------- Margin / winner ---------- */

export function limitedMargin(
  weWon: boolean,
  weBattedFirst: boolean,
  ourInn: Innings,
  oppInn: Innings,
): string {
  const winnerBattedSecond = weWon ? !weBattedFirst : weBattedFirst;
  if (winnerBattedSecond) {
    const winInn = weWon ? ourInn : oppInn;
    const wktsLeft = 10 - winInn.wickets;
    return `${weWon ? "won" : "lost"} by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
  }
  const diff = Math.abs(ourInn.runs - oppInn.runs);
  return `${weWon ? "won" : "lost"} by ${diff} run${diff === 1 ? "" : "s"}`;
}

/* ---------- Player of the match ---------- */

export function pickPlayerOfMatch(
  winnerBatters: BatterState[],
  winnerBowlerStates: BowlerState[],
): string {
  const topBat = [...winnerBatters].sort((a, b) => b.runs - a.runs)[0];
  const batScore = topBat ? topBat.runs + topBat.fours * 2 + topBat.sixes * 3 : 0;
  const bestBowl = [...winnerBowlerStates].sort(
    (a, b) => b.wickets * 25 - b.runs - (a.wickets * 25 - a.runs),
  )[0];
  const bowlScore = bestBowl ? bestBowl.wickets * 30 - bestBowl.runs * 0.6 : 0;
  return batScore >= bowlScore
    ? (topBat?.p.name ?? bestBowl?.p.name ?? "—")
    : (bestBowl?.p.name ?? topBat?.p.name ?? "—");
}

/* ---------- Commentary from events ---------- */

const TOSS_LINES = [
  (t: string, d: string, p: string) =>
    `${t} called it right at the toss and elected to ${d} on a ${p.toLowerCase()} deck.`,
  (t: string, d: string, p: string) =>
    `Coin lands ${t}'s way — ${d}ting first looks the play on this ${p.toLowerCase()} surface.`,
  (t: string, d: string, p: string) =>
    `${t} won the toss and had no hesitation choosing to ${d} on the ${p.toLowerCase()} strip.`,
];

function ppStats(events: MatchEvent[], format: Format) {
  const end = format === "T20" ? 6 : 10;
  const pp = events.filter((e) => e.over < end);
  return { runs: pp.reduce((s, e) => s + e.runs, 0), wkts: pp.filter((e) => e.wicket).length };
}

function deathStats(events: MatchEvent[], format: Format) {
  const start = format === "T20" ? 15 : 40;
  const d = events.filter((e) => e.over >= start);
  return { runs: d.reduce((s, e) => s + e.runs, 0), wkts: d.filter((e) => e.wicket).length };
}

export function limitedCommentaryFromEvents(
  r: LimitedScorecard,
  firstState: InningsState,
  secondState: InningsState,
  rng: Rng,
): string[] {
  const lines: string[] = [];
  const firstInn = firstState.teamName === r.ourName ? r.ourInnings : r.oppInnings;
  const secondInn = secondState.teamName === r.ourName ? r.ourInnings : r.oppInnings;
  const tossName = r.toss.winner === "us" ? r.ourName : r.oppName;
  lines.push(pick(TOSS_LINES, rng)(tossName, r.toss.decision, r.pitch));

  // Powerplay
  const pp = ppStats(firstState.events, r.format);
  if (pp.wkts >= 3) {
    lines.push(
      `${firstInn.teamName} slumped to ${pp.runs}/${pp.wkts} inside the powerplay — the new ball did serious damage.`,
    );
  } else if (pp.runs >= (r.format === "T20" ? 55 : 65)) {
    lines.push(
      `${firstInn.teamName} exploded out of the blocks — ${pp.runs}/${pp.wkts} at the end of the powerplay.`,
    );
  } else {
    lines.push(`${firstInn.teamName} settled through the powerplay for ${pp.runs}/${pp.wkts}.`);
  }

  // Top scorer
  const top = [...firstState.batters].sort((a, b) => b.runs - a.runs)[0];
  if (top && top.runs >= 100) {
    lines.push(
      `${top.p.name} raised a stunning hundred (${top.runs} off ${top.balls}, ${top.fours}×4, ${top.sixes}×6).`,
    );
  } else if (top && top.runs >= 50) {
    const sr = top.balls ? Math.round((top.runs * 100) / top.balls) : 0;
    if (sr >= 140)
      lines.push(
        `${top.p.name} tore into the attack — ${top.runs} off ${top.balls} at a strike rate of ${sr}.`,
      );
    else lines.push(`${top.p.name} anchored with ${top.runs} off ${top.balls}.`);
  } else if (top && top.runs >= 30) {
    lines.push(`${top.p.name} top-scored with ${top.runs} but no one really kicked on.`);
  }

  // Best bowler defending / bowling first
  const firstBowlers = Array.from(firstState.bowlers.values())
    .filter((b) => b.balls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
  const b1 = firstBowlers[0];
  if (b1 && b1.wickets >= 5)
    lines.push(`${b1.p.name} tore through the middle order — ${b1.wickets}/${b1.runs}.`);
  else if (b1 && b1.wickets >= 3)
    lines.push(
      `${b1.p.name} led the attack with ${b1.wickets}/${b1.runs} in ${Math.round(oversFromBalls(b1.balls) * 10) / 10}.`,
    );

  // Death overs summary
  const death = deathStats(firstState.events, r.format);
  if (r.format === "T20" && death.runs >= 55)
    lines.push(`A brutal death: ${death.runs} runs came off the last five overs.`);
  else if (r.format === "ODI" && death.runs >= 90)
    lines.push(`Death overs went the distance — ${death.runs} runs off the final ten.`);

  // Innings break
  lines.push(
    `Innings break: ${firstInn.teamName} ${firstInn.runs}/${firstInn.wickets} (${firstInn.overs}). ${secondInn.teamName} chasing ${firstInn.runs + 1}.`,
  );

  // Chase / defense
  const target = firstInn.runs + 1;
  const chaseWon = secondInn.runs >= target;
  const usedBalls = Math.floor(secondInn.overs) * 6 + Math.round((secondInn.overs % 1) * 10);
  const totalBalls = r.format === "T20" ? 120 : 300;
  const ballsLeft = Math.max(0, totalBalls - usedBalls);
  const wktsLeft = 10 - secondInn.wickets;

  if (chaseWon) {
    if (ballsLeft <= 6)
      lines.push(
        `Down to the wire! ${secondInn.teamName} got home with ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} to spare.`,
      );
    else if (wktsLeft >= 6)
      lines.push(`${secondInn.teamName} cruised over the line with ${wktsLeft} wickets in hand.`);
    else lines.push(`${secondInn.teamName} rebuilt after early stumbles and completed the chase.`);

    const chaseTop = [...secondState.batters].sort((a, b) => b.runs - a.runs)[0];
    if (chaseTop && chaseTop.runs >= 50) {
      lines.push(
        `${chaseTop.p.name} anchored the chase with ${chaseTop.runs} off ${chaseTop.balls}.`,
      );
    }
  } else {
    const short = target - 1 - secondInn.runs;
    if (secondInn.wickets === 10)
      lines.push(
        `${secondInn.teamName} were bowled out ${short} run${short === 1 ? "" : "s"} short.`,
      );
    else if (short <= 10)
      lines.push(`Heartbreak — ${secondInn.teamName} fell just ${short} short.`);
    else lines.push(`${secondInn.teamName} were kept in check and finished ${short} adrift.`);

    const defBowlers = Array.from(secondState.bowlers.values())
      .filter((b) => b.balls > 0)
      .sort((a, b) => b.wickets - a.wickets);
    if (defBowlers[0] && defBowlers[0].wickets >= 3) {
      lines.push(
        `${defBowlers[0].p.name} sealed the defence with ${defBowlers[0].wickets}/${defBowlers[0].runs}.`,
      );
    }
  }

  lines.push(`Player of the Match: ${r.playerOfMatch}.`);
  return lines;
}

/* ---------- Match orchestration ---------- */

export interface Opponent {
  name: string;
  rating: number;
  players: Player[];
}

const PITCHES: Pitch[] = ["Green", "Flat", "Dusty", "Turning", "Slow"];
const WEATHERS: Weather[] = ["Sunny", "Cloudy", "Humid", "Night Match"];

/** Global (international) venue pool — used by ICC events. */
const INTERNATIONAL_VENUES = [
  "Wankhede, Mumbai",
  "Eden Gardens, Kolkata",
  "MCG, Melbourne",
  "Lord's, London",
  "SCG, Sydney",
  "Newlands, Cape Town",
  "Chinnaswamy, Bengaluru",
  "Gaddafi, Lahore",
  "R. Premadasa, Colombo",
  "Kensington Oval, Bridgetown",
  "Basin Reserve, Wellington",
  "Trent Bridge, Nottingham",
  "Adelaide Oval",
];

/**
 * The IPL has only ever been hosted in India, South Africa (2009) and the
 * UAE (2014 part, 2020, 2021 part) — no English or Australian grounds.
 */
const FRANCHISE_VENUES = [
  // India
  "Wankhede, Mumbai",
  "Eden Gardens, Kolkata",
  "M. A. Chidambaram, Chennai",
  "Narendra Modi Stadium, Ahmedabad",
  "M. Chinnaswamy, Bengaluru",
  "Arun Jaitley Stadium, Delhi",
  "Rajiv Gandhi Stadium, Hyderabad",
  "Sawai Mansingh, Jaipur",
  "PCA Stadium, Mohali",
  "Ekana Stadium, Lucknow",
  // South Africa
  "The Wanderers, Johannesburg",
  "Kingsmead, Durban",
  "Newlands, Cape Town",
  "SuperSport Park, Centurion",
  // UAE
  "Dubai International Stadium",
  "Sheikh Zayed Stadium, Abu Dhabi",
  "Sharjah Cricket Stadium",
];

export function venuePool(mode: GameMode): string[] {
  return mode === "FRANCHISE_T20" ? FRANCHISE_VENUES : INTERNATIONAL_VENUES;
}

/** Six legal deliveries a side, two wickets and you're done. Decided, never tied. */
function simulateSuperOver(
  ourName: string,
  ourPlayers: Player[],
  oppName: string,
  oppPlayers: Player[],
  rng: Rng,
): SuperOver {
  const strength = (ps: Player[]) => {
    const top = [...ps].sort((a, b) => b.stats.batting - a.stats.batting).slice(0, 3);
    return top.reduce((s, p) => s + p.stats.batting, 0) / (top.length || 1);
  };
  const sideScore = (ps: Player[]) => {
    const base = 6 + (strength(ps) - 70) / 6;
    let runs = 0,
      wickets = 0;
    for (let b = 0; b < 6 && wickets < 2; b++) {
      const roll = rng();
      if (roll < 0.12) {
        wickets++;
        continue;
      }
      runs += Math.max(0, Math.round(base / 6 + (rng() * 5 - 1.4)));
    }
    return { runs, wickets };
  };
  let ours = sideScore(ourPlayers);
  let opp = sideScore(oppPlayers);
  let guard = 0;
  while (ours.runs === opp.runs && guard++ < 20) {
    ours = sideScore(ourPlayers);
    opp = sideScore(oppPlayers);
  }
  if (ours.runs === opp.runs) ours = { ...ours, runs: ours.runs + 1 };
  const weWon = ours.runs > opp.runs;
  return {
    ours: { teamName: ourName, runs: ours.runs, wickets: ours.wickets },
    opp: { teamName: oppName, runs: opp.runs, wickets: opp.wickets },
    winner: weWon ? ourName : oppName,
    weWon,
  };
}

export function simulateLimitedMatch(
  ourName: string,
  ourPlayers: Player[],
  opp: Opponent,
  mode: GameMode,
  stage: StageKind,
  rng: Rng,
  chemistryBonus: number,
): LimitedScorecard {
  const format: Format = mode === "T20_WC" || mode === "FRANCHISE_T20" ? "T20" : "ODI";
  const pitch = pick(PITCHES, rng);
  const weather = pick(WEATHERS, rng);
  const venue = pick(venuePool(mode), rng);
  const toss = decideToss(pitch, weather, format, rng);

  const weBattedFirst =
    (toss.winner === "us" && toss.decision === "bat") ||
    (toss.winner === "opp" && toss.decision === "bowl");

  const yearHint =
    format === "T20"
      ? mode === "FRANCHISE_T20"
        ? 2020
        : 2018
      : mode === "CHAMPIONS"
        ? 2017
        : 2015;
  const era = eraMultiplier(yearHint, mode);

  const ctx: SimContext = { format, pitch, weather, era, chemistryBonus };

  let ourState: InningsState;
  let oppState: InningsState;
  if (weBattedFirst) {
    ourState = simulateInnings(ourName, ourPlayers, opp.players, ctx, rng);
    const target = ourState.runs + 1;
    oppState = simulateInnings(opp.name, opp.players, ourPlayers, ctx, rng, target);
  } else {
    oppState = simulateInnings(opp.name, opp.players, ourPlayers, ctx, rng);
    const target = oppState.runs + 1;
    ourState = simulateInnings(ourName, ourPlayers, opp.players, ctx, rng, target);
  }

  const ourInn = summariseInnings(ourState);
  const oppInn = summariseInnings(oppState);

  const tied = ourInn.runs === oppInn.runs;
  const superOver = tied
    ? simulateSuperOver(ourName, ourPlayers, opp.name, opp.players, rng)
    : undefined;
  const weWon = superOver ? superOver.weWon : ourInn.runs > oppInn.runs;
  const marginText = superOver
    ? `${weWon ? "won" : "lost"} the Super Over (${superOver.ours.runs}/${superOver.ours.wickets} v ${superOver.opp.runs}/${superOver.opp.wickets})`
    : limitedMargin(weWon, weBattedFirst, ourInn, oppInn);
  const resultLine = superOver
    ? `Match tied · ${superOver.winner} won the Super Over ${superOver.weWon ? superOver.ours.runs : superOver.opp.runs}/${superOver.weWon ? superOver.ours.wickets : superOver.opp.wickets} to ${superOver.weWon ? superOver.opp.runs : superOver.ours.runs}/${superOver.weWon ? superOver.opp.wickets : superOver.ours.wickets}`
    : `${weWon ? ourName : opp.name} ${marginText.replace(/^won|lost/, "won")}`;

  const winnerState = weWon ? ourState : oppState;
  const loserState = weWon ? oppState : ourState;
  const pom = pickPlayerOfMatch(
    winnerState.batters,
    Array.from(loserState.bowlers.values()), // winners bowled *at* losers
  );

  const scorecard: LimitedScorecard = {
    format,
    stage,
    venue,
    pitch,
    weather,
    toss: { winner: toss.winner, decision: toss.decision },
    ourName,
    oppName: opp.name,
    ourInnings: ourInn,
    oppInnings: oppInn,
    weWon,
    marginText,
    resultLine,
    playerOfMatch: pom,
    highlights: [],
    superOver,
    eliminated: !weWon && (KNOCKOUT_STAGES as string[]).includes(stage),
  };
  const firstState = weBattedFirst ? ourState : oppState;
  const secondState = weBattedFirst ? oppState : ourState;
  scorecard.highlights = limitedCommentaryFromEvents(scorecard, firstState, secondState, rng);
  if (superOver) {
    scorecard.highlights.unshift(
      `Scores level after 20 overs — Super Over: ${superOver.ours.teamName} ${superOver.ours.runs}/${superOver.ours.wickets}, ${superOver.opp.teamName} ${superOver.opp.runs}/${superOver.opp.wickets}. ${superOver.winner} won it.`,
    );
  }
  scorecard.full = [
    toFullInnings(firstState, "1st Innings"),
    toFullInnings(secondState, "2nd Innings"),
  ];

  // Sanity checks
  validateLimited(scorecard);

  // touch WK for future stumping fidelity (avoid unused import warning)
  void wicketkeeper;
  return scorecard;
}

function validateLimited(r: LimitedScorecard) {
  const maxOvers = r.format === "T20" ? 20 : 50;
  if (r.ourInnings.overs > maxOvers + 0.01 || r.oppInnings.overs > maxOvers + 0.01) {
    console.warn("[sim] overs exceed max", r);
  }
  const winnerRuns = r.weWon ? r.ourInnings.runs : r.oppInnings.runs;
  const loserRuns = r.weWon ? r.oppInnings.runs : r.ourInnings.runs;
  if (!r.superOver && winnerRuns < loserRuns) {
    console.warn("[sim] winner has fewer runs than loser", r);
  }
  const maxBowlOvers = r.format === "T20" ? 4 : 10;
  for (const inn of [r.ourInnings, r.oppInnings]) {
    if (inn.bestBowler.overs > maxBowlOvers + 0.01) {
      console.warn("[sim] bowler exceeded over cap", inn);
    }
  }
}
