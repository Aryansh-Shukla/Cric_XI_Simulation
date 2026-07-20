import type { Player, Pitch, Weather, Innings, TestScorecard, StageKind } from "../types";
import { attrs, battingOrder, bowlingPool } from "./attributes";
import { clamp, pick, Rng, weightedPick } from "./rng";

/**
 * Test match engine — separate from limited overs.
 * Time budget: 5 days × ~90 overs = 450 overs = 2700 balls shared across all innings.
 * Innings can end by: all out, declaration (batting first with big lead), target reached
 * (fourth innings), or time running out (draw for match).
 */

const TOTAL_BALLS_BUDGET = 2700;

interface BatterState {
  p: Player; runs: number; balls: number; fours: number; sixes: number; out: boolean;
}
interface BowlerState {
  p: Player; balls: number; runs: number; wickets: number; maidens: number;
}
interface InningsState {
  teamName: string;
  runs: number; wickets: number; balls: number;
  batters: BatterState[];
  bowlers: Map<string, BowlerState>;
  partnerships: { a: string; b: string; runs: number; balls: number }[];
  declared: boolean;
  followedOn: boolean;
  chased: boolean;
  outOfTime: boolean;
}

function pitchFactors(pitch: Pitch, matchDay: number) {
  // Pitches deteriorate over 5 days
  const wear = clamp((matchDay - 1) / 4, 0, 1); // 0..1
  switch (pitch) {
    case "Flat":    return { bat: 1.08 - 0.15 * wear, wkt: 0.85 + 0.35 * wear };
    case "Green":   return { bat: 0.88 - 0.05 * wear, wkt: 1.25 + 0.15 * wear };
    case "Dusty":   return { bat: 0.93 - 0.10 * wear, wkt: 1.10 + 0.40 * wear };
    case "Turning": return { bat: 0.90 - 0.12 * wear, wkt: 1.20 + 0.45 * wear };
    case "Slow":    return { bat: 0.90 - 0.05 * wear, wkt: 1.08 + 0.20 * wear };
  }
}

function weatherFactors(w: Weather) {
  switch (w) {
    case "Sunny":       return { bat: 1.02, wkt: 0.97 };
    case "Cloudy":      return { bat: 0.94, wkt: 1.12 };
    case "Humid":       return { bat: 0.96, wkt: 1.08 };
    case "Night Match": return { bat: 1.00, wkt: 1.00 };
  }
}

function pickBowler(
  bowlers: Player[],
  states: Map<string, BowlerState>,
  lastBowlerId: string | null,
  ballsIntoInnings: number,
  rng: Rng,
) {
  const eligible = bowlers.filter(b => b.id !== lastBowlerId);
  const pool = eligible.length ? eligible : bowlers;
  const weights = pool.map(b => {
    const a = attrs(b);
    // early: pace bias; middle: spin & control
    const early = ballsIntoInnings < 90;
    const skill = early ? a.ppBowl : a.midBowl;
    const stamPenalty = (states.get(b.id)!.balls) / (a.stamina + 40);
    return Math.pow(Math.max(1, skill), 3) / (1 + stamPenalty);
  });
  return weightedPick(pool, weights, rng);
}

function ballOutcome(
  bat: BatterState, bwl: BowlerState, pitch: Pitch, weather: Weather,
  matchDay: number, chasePressure: number, wicketsDown: number, rng: Rng,
): { runs: number; wicket: boolean; dismissal?: string } {
  const bA = attrs(bat.p);
  const wA = attrs(bwl.p);
  const skill = 1 + (bA.midBat - wA.midBowl) / 240;
  const pf = pitchFactors(pitch, matchDay);
  const wf = weatherFactors(weather);

  // Baseline test scoring rates
  const baseRpo = 3.3;
  const baseWkt = 0.014;

  const rpo = baseRpo * skill * pf.bat * wf.bat * (1 + chasePressure * 0.35);
  const meanRpb = clamp(rpo / 6, 0.25, 1.8);

  let pWkt =
    (baseWkt / Math.max(0.8, skill)) *
    pf.wkt *
    wf.wkt *
    (chasePressure > 0.6 ? 1.25 : 1) *
    (wicketsDown >= 7 ? 1.15 : 1);
  pWkt = clamp(pWkt, 0.005, 0.10);

  if (rng() < pWkt) {
    const roll = rng();
    const dismissal =
      roll < 0.28 ? "c" :
      roll < 0.5 ? "b" :
      roll < 0.72 ? "lbw" :
      roll < 0.88 ? "c wk" :
      wA.isSpin ? "st" : "c&b";
    return { runs: 0, wicket: true, dismissal };
  }

  const p6 = clamp(0.005 + (meanRpb - 0.4) * 0.02, 0.001, 0.04);
  const p4 = clamp(0.06 + (meanRpb - 0.4) * 0.08, 0.02, 0.16);
  const p2 = 0.06;
  const p3 = 0.005;
  const known = 6 * p6 + 4 * p4 + 2 * p2 + 3 * p3;
  const p1 = clamp(meanRpb - known, 0.05, 0.55);
  const p0 = clamp(1 - (p6 + p4 + p2 + p3 + p1), 0.05, 0.9);

  const r = rng();
  let cum = p0;
  if (r < cum) return { runs: 0, wicket: false };
  cum += p1; if (r < cum) return { runs: 1, wicket: false };
  cum += p2; if (r < cum) return { runs: 2, wicket: false };
  cum += p3; if (r < cum) return { runs: 3, wicket: false };
  cum += p4; if (r < cum) return { runs: 4, wicket: false };
  return { runs: 6, wicket: false };
}

interface TestInningsOpts {
  target?: number;                // if chasing, stop when reached
  ballsBudget: number;            // max balls (from remaining match time)
  declareThreshold?: number;      // declare when lead >= threshold and enough time left
  currentLeadBase?: number;       // score already ahead (for declare calc)
  captainLeadership?: number;
}

function simTestInnings(
  teamName: string,
  batting: Player[],
  bowling: Player[],
  pitch: Pitch,
  weather: Weather,
  matchDay: () => number,
  rng: Rng,
  opts: TestInningsOpts,
): InningsState {
  const order = battingOrder(batting);
  const bowlers = bowlingPool(bowling);

  const batters: BatterState[] = order.map(p => ({
    p, runs: 0, balls: 0, fours: 0, sixes: 0, out: false,
  }));
  const bowlerStates = new Map<string, BowlerState>();
  for (const b of bowlers) bowlerStates.set(b.id, { p: b, balls: 0, runs: 0, wickets: 0, maidens: 0 });

  let striker = 0, nonStriker = 1, nextBat = 2;
  let runs = 0, wickets = 0, balls = 0;
  const partnerships: InningsState["partnerships"] = [];
  let curPart = { a: batters[0].p.name, b: batters[1].p.name, runs: 0, balls: 0 };
  let lastBowlerId: string | null = null;
  let declared = false;
  let chased = false;
  let outOfTime = false;

  const maxOvers = Math.floor(opts.ballsBudget / 6);

  outer:
  for (let over = 0; over < maxOvers; over++) {
    const bowler = pickBowler(bowlers, bowlerStates, lastBowlerId, balls, rng);
    lastBowlerId = bowler.id;
    const bwState = bowlerStates.get(bowler.id)!;
    let overRuns = 0;

    for (let bn = 0; bn < 6; bn++) {
      if (wickets >= 10) break outer;
      if (opts.target !== undefined && runs >= opts.target) { chased = true; break outer; }
      if (balls >= opts.ballsBudget) { outOfTime = true; break outer; }

      // Declaration check between deliveries when batting for a lead
      if (
        opts.declareThreshold !== undefined &&
        opts.target === undefined &&
        wickets >= 3
      ) {
        const lead = runs + (opts.currentLeadBase ?? 0);
        const remaining = opts.ballsBudget - balls;
        // Enough time to bowl opp out (~ 40+ overs) and lead solid
        if (lead >= opts.declareThreshold && remaining >= 60 * 6 && rng() < 0.04) {
          declared = true;
          break outer;
        }
      }

      const batState = batters[striker];
      const chasePressure = opts.target
        ? clamp((opts.target - runs) / Math.max(1, opts.ballsBudget - balls) - 0.35, 0, 1.2)
        : 0;
      const out = ballOutcome(batState, bwState, pitch, weather, matchDay(), chasePressure, wickets, rng);
      balls++; batState.balls++; bwState.balls++;

      if (out.wicket) {
        wickets++;
        batState.out = true;
        bwState.wickets++;
        partnerships.push({ ...curPart, balls: curPart.balls + 1 });
        if (nextBat < batters.length) {
          striker = nextBat; nextBat++;
          curPart = { a: batters[striker].p.name, b: batters[nonStriker].p.name, runs: 0, balls: 0 };
        }
      } else {
        runs += out.runs; bwState.runs += out.runs; batState.runs += out.runs;
        overRuns += out.runs;
        if (out.runs === 4) batState.fours++;
        if (out.runs === 6) batState.sixes++;
        curPart.runs += out.runs; curPart.balls++;
        if (out.runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
      }
    }
    [striker, nonStriker] = [nonStriker, striker];
    if (overRuns === 0 && bwState.balls >= 6) bwState.maidens++;
  }

  if (curPart.balls > 0) partnerships.push({ ...curPart });

  return {
    teamName, runs, wickets, balls,
    batters, bowlers: bowlerStates,
    partnerships, declared, followedOn: false, chased, outOfTime,
  };
}

function oversFromBalls(b: number) {
  return Math.floor(b / 6) + (b % 6) / 10;
}

function summarise(s: InningsState, followOn: boolean): Innings {
  const overs = Math.round(oversFromBalls(s.balls) * 10) / 10;
  const runRate = s.balls > 0 ? Math.round((s.runs * 6 / s.balls) * 100) / 100 : 0;
  const top = [...s.batters].filter(b => b.balls > 0).sort((a, b) => b.runs - a.runs)[0] ?? s.batters[0];
  const bowls = Array.from(s.bowlers.values()).filter(b => b.balls > 0);
  const best = bowls.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0] ?? null;
  const topPart = [...s.partnerships].sort((a, b) => b.runs - a.runs)[0] ??
    { a: s.batters[0].p.name, b: s.batters[1]?.p.name ?? s.batters[0].p.name, runs: 0, balls: 0 };
  return {
    teamName: s.teamName, runs: s.runs, wickets: s.wickets, overs, runRate,
    topScorer: { name: top.p.name, runs: top.runs, balls: top.balls },
    bestBowler: best
      ? { name: best.p.name, wickets: best.wickets, runs: best.runs, overs: Math.round(oversFromBalls(best.balls) * 10) / 10 }
      : { name: "—", wickets: 0, runs: 0, overs: 0 },
    partnership: { names: [topPart.a, topPart.b], runs: topPart.runs },
    declared: s.declared || undefined,
    followOn: followOn || undefined,
  };
}

/* ---------- Test match orchestration ---------- */

const PITCHES: Pitch[] = ["Green", "Flat", "Dusty", "Turning", "Slow"];
const WEATHERS: Weather[] = ["Sunny", "Cloudy", "Humid", "Night Match"];
const VENUES = [
  "Lord's, London", "MCG, Melbourne", "SCG, Sydney", "Newlands, Cape Town",
  "Chinnaswamy, Bangalore", "Wankhede, Mumbai", "Eden Gardens, Kolkata",
  "Trent Bridge, Nottingham", "Adelaide Oval", "Gaddafi, Lahore",
];

export function simulateTestMatch(
  ourName: string,
  ourPlayers: Player[],
  opp: { name: string; players: Player[] },
  stage: StageKind,
  rng: Rng,
  captain: Player,
): TestScorecard {
  const pitch = pick(PITCHES, rng);
  const weather = pick(WEATHERS, rng);
  const venue = pick(VENUES, rng);
  const tossWinner: "us" | "opp" = rng() < 0.5 ? "us" : "opp";
  // Test toss: bat first bias unless very green + cloudy
  let batBias = 0.62;
  if (pitch === "Green") batBias -= 0.25;
  if (weather === "Cloudy") batBias -= 0.1;
  if (pitch === "Flat") batBias += 0.1;
  const tossDecision: "bat" | "bowl" = rng() < clamp(batBias, 0.2, 0.9) ? "bat" : "bowl";

  const weBattedFirst = (tossWinner === "us" && tossDecision === "bat") ||
                        (tossWinner === "opp" && tossDecision === "bowl");

  let ballsUsed = 0;
  const dayOf = () => 1 + Math.floor(ballsUsed / (TOTAL_BALLS_BUDGET / 5));

  const ourAll: InningsState[] = [];
  const oppAll: InningsState[] = [];

  const firstBat = weBattedFirst ? { name: ourName, players: ourPlayers, tag: "us" as const }
                                 : { name: opp.name, players: opp.players, tag: "opp" as const };
  const secondBat = weBattedFirst ? { name: opp.name, players: opp.players, tag: "opp" as const }
                                  : { name: ourName, players: ourPlayers, tag: "us" as const };

  const push = (tag: "us" | "opp", s: InningsState) => (tag === "us" ? ourAll : oppAll).push(s);

  // 1st innings — team batting first
  const inn1 = simTestInnings(
    firstBat.name, firstBat.players, secondBat.players, pitch, weather, dayOf, rng,
    { ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed, declareThreshold: 500, captainLeadership: captain.stats.leadership },
  );
  push(firstBat.tag, inn1);
  ballsUsed += inn1.balls;

  // 2nd innings — team batting second
  const inn2 = simTestInnings(
    secondBat.name, secondBat.players, firstBat.players, pitch, weather, dayOf, rng,
    { ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed, declareThreshold: 500, captainLeadership: captain.stats.leadership },
  );
  push(secondBat.tag, inn2);
  ballsUsed += inn2.balls;

  // Follow-on decision
  const lead = inn1.runs - inn2.runs;
  let followOnEnforced = false;
  const remainingAfter2 = TOTAL_BALLS_BUDGET - ballsUsed;
  if (lead >= 200 && remainingAfter2 >= 120 * 6 && rng() < 0.45 + captain.stats.leadership / 500) {
    followOnEnforced = true;
  }

  if (followOnEnforced) {
    // second batting team bats again
    const inn3 = simTestInnings(
      secondBat.name, secondBat.players, firstBat.players, pitch, weather, dayOf, rng,
      { ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed, captainLeadership: captain.stats.leadership },
    );
    inn3.followedOn = true;
    push(secondBat.tag, inn3);
    ballsUsed += inn3.balls;

    const secondTotal = inn2.runs + inn3.runs;
    if (secondTotal < inn1.runs && inn3.wickets === 10) {
      // Innings victory, first bat wins without needing 4th innings
    } else if (secondTotal >= inn1.runs && inn3.wickets < 10) {
      // 2nd team leads → 1st team must bat 4th innings chasing
      const chaseTarget = secondTotal - inn1.runs + 1;
      const inn4 = simTestInnings(
        firstBat.name, firstBat.players, secondBat.players, pitch, weather, dayOf, rng,
        { ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed, target: chaseTarget, captainLeadership: captain.stats.leadership },
      );
      push(firstBat.tag, inn4);
      ballsUsed += inn4.balls;
    }
  } else {
    // Normal path: 1st batting team bats 3rd innings, 2nd batting team chases 4th
    if (remainingAfter2 > 60 * 6 && inn2.wickets === 10) {
      const inn3 = simTestInnings(
        firstBat.name, firstBat.players, secondBat.players, pitch, weather, dayOf, rng,
        {
          ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed,
          declareThreshold: Math.max(180, 260 - lead),
          currentLeadBase: lead,
          captainLeadership: captain.stats.leadership,
        },
      );
      push(firstBat.tag, inn3);
      ballsUsed += inn3.balls;

      const chaseTarget = inn1.runs + inn3.runs - inn2.runs + 1;
      if (chaseTarget > 0 && ballsUsed < TOTAL_BALLS_BUDGET - 30) {
        const inn4 = simTestInnings(
          secondBat.name, secondBat.players, firstBat.players, pitch, weather, dayOf, rng,
          { ballsBudget: TOTAL_BALLS_BUDGET - ballsUsed, target: chaseTarget, captainLeadership: captain.stats.leadership },
        );
        push(secondBat.tag, inn4);
        ballsUsed += inn4.balls;
      }
    }
  }

  // Compute result
  const ourTotal = ourAll.reduce((s, i) => s + i.runs, 0);
  const oppTotal = oppAll.reduce((s, i) => s + i.runs, 0);

  let result: "WON" | "LOST" | "DRAW";
  let marginText: string;

  const lastInn = [...ourAll, ...oppAll].sort((a, b) => 0)[[...ourAll, ...oppAll].length - 1];
  void lastInn;

  // Determine winner strictly from scores + who batted last
  if (followOnEnforced) {
    // Innings win possible for firstBat if secondBat total (both innings) < inn1
    const secondTotal = inn2.runs + (secondBat.tag === "us" ? (ourAll[1]?.runs ?? 0) : (oppAll[1]?.runs ?? 0));
    // Actually second-bat innings after f/o: for secondBat side, they now have inn2 + inn3
    const secondBatTotal = (secondBat.tag === "us" ? ourAll : oppAll).reduce((s, i) => s + i.runs, 0);
    const secondBatLastAllOut = (secondBat.tag === "us" ? ourAll : oppAll).slice(-1)[0]?.wickets === 10;
    if (secondBatTotal < inn1.runs && secondBatLastAllOut) {
      const winnerTag = firstBat.tag;
      const margin = inn1.runs - secondBatTotal;
      result = winnerTag === "us" ? "WON" : "LOST";
      marginText = `${result === "WON" ? "won" : "lost"} by an innings and ${margin} run${margin === 1 ? "" : "s"}`;
    } else {
      // First bat had to chase; look for chase result
      const chaseInn = (firstBat.tag === "us" ? ourAll : oppAll).slice(-1)[0];
      const chaseTarget = secondTotal - inn1.runs + 1;
      if (chaseInn && chaseInn.chased) {
        const winnerTag = firstBat.tag;
        result = winnerTag === "us" ? "WON" : "LOST";
        const wktsLeft = 10 - chaseInn.wickets;
        marginText = `${result === "WON" ? "won" : "lost"} by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
      } else if (chaseInn && chaseInn.wickets === 10) {
        const winnerTag = secondBat.tag;
        result = winnerTag === "us" ? "WON" : "LOST";
        const runs = chaseTarget - 1 - chaseInn.runs;
        marginText = `${result === "WON" ? "won" : "lost"} by ${runs} run${runs === 1 ? "" : "s"}`;
      } else {
        result = "DRAW";
        marginText = "Match drawn — stumps on Day 5";
      }
    }
  } else {
    // Normal: check 4th-innings chase result
    const chaseInn = (secondBat.tag === "us" ? ourAll : oppAll).slice(-1)[0];
    const setterInn = (firstBat.tag === "us" ? ourAll : oppAll).slice(-1)[0];
    if (chaseInn && (chaseInn.chased || chaseInn.wickets === 10) && setterInn) {
      if (chaseInn.chased) {
        const winnerTag = secondBat.tag;
        result = winnerTag === "us" ? "WON" : "LOST";
        const wktsLeft = 10 - chaseInn.wickets;
        marginText = `${result === "WON" ? "won" : "lost"} by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
      } else {
        const target = (firstBat.tag === "us" ? ourTotal : oppTotal) - (secondBat.tag === "us" ? ourAll : oppAll).slice(0, -1).reduce((s, i) => s + i.runs, 0) + 1;
        const winnerTag = firstBat.tag;
        result = winnerTag === "us" ? "WON" : "LOST";
        const runs = Math.max(1, target - 1 - chaseInn.runs);
        marginText = `${result === "WON" ? "won" : "lost"} by ${runs} run${runs === 1 ? "" : "s"}`;
      }
    } else {
      result = "DRAW";
      marginText = "Match drawn — stumps on Day 5";
    }
  }

  // Player of match
  const potPool = result === "WON" ? ourPlayers : result === "LOST" ? opp.players : ourPlayers;
  const potPoolBatters = [...potPool].sort((a, b) => b.stats.batting - a.stats.batting)[0];
  const potPoolBowlers = [...potPool].sort((a, b) => b.stats.bowling - a.stats.bowling)[0];
  // pick whichever contributed more using stat snapshots from the match
  const allInn = [...ourAll, ...oppAll];
  const bestBatOverall = allInn.flatMap(i => i.batters).sort((a, b) => b.runs - a.runs)[0];
  const bestBowlOverall = allInn.flatMap(i => Array.from(i.bowlers.values())).sort(
    (a, b) => (b.wickets * 25 - b.runs) - (a.wickets * 25 - a.runs),
  )[0];
  const pom =
    (bestBatOverall?.runs ?? 0) >= ((bestBowlOverall?.wickets ?? 0) * 20)
      ? bestBatOverall?.p.name ?? potPoolBatters.name
      : bestBowlOverall?.p.name ?? potPoolBowlers.name;

  const resultLine = result === "DRAW"
    ? "Match drawn"
    : `${result === "WON" ? ourName : opp.name} ${marginText.replace(/^won|lost/, "won")}`;

  // Session commentary from actual innings
  const highlights = testHighlights({
    ourName, oppName: opp.name, tossWinner, tossDecision, pitch, weather,
    firstBat, secondBat, ourAll, oppAll, inn1, inn2, followOnEnforced, result, marginText, pom,
  }, rng);

  return {
    format: "TEST",
    stage,
    venue,
    pitch,
    weather,
    toss: { winner: tossWinner, decision: tossDecision },
    ourName,
    oppName: opp.name,
    ourInnings: ourAll.map((s, i) => summarise(s, i === 1 && (ourAll[1]?.followedOn ?? false))),
    oppInnings: oppAll.map((s, i) => summarise(s, i === 1 && (oppAll[1]?.followedOn ?? false))),
    result,
    marginText,
    resultLine,
    playerOfMatch: pom,
    highlights,
    sessionsNote: highlights.join("  "),
    eliminated: false,
  };
}

/* ---------- Test commentary ---------- */

interface HlCtx {
  ourName: string; oppName: string;
  tossWinner: "us" | "opp"; tossDecision: "bat" | "bowl";
  pitch: Pitch; weather: Weather;
  firstBat: { name: string; tag: "us" | "opp" };
  secondBat: { name: string; tag: "us" | "opp" };
  ourAll: InningsState[]; oppAll: InningsState[];
  inn1: InningsState; inn2: InningsState;
  followOnEnforced: boolean;
  result: "WON" | "LOST" | "DRAW";
  marginText: string;
  pom: string;
}

function testHighlights(c: HlCtx, rng: Rng): string[] {
  const lines: string[] = [];
  const tossName = c.tossWinner === "us" ? c.ourName : c.oppName;
  lines.push(`Day 1 Morning: ${tossName} won the toss and chose to ${c.tossDecision} on a ${c.pitch.toLowerCase()} pitch under ${c.weather.toLowerCase()} skies.`);

  const top1 = [...c.inn1.batters].sort((a, b) => b.runs - a.runs)[0];
  if (top1 && top1.runs >= 100) {
    lines.push(`Day 1: ${top1.p.name} carried the bat to ${top1.runs} — the innings built around him.`);
  } else if (top1 && top1.runs >= 50) {
    lines.push(`Day 1: ${top1.p.name} anchored with ${top1.runs} off ${top1.balls} balls.`);
  }

  const best1 = Array.from(c.inn1.bowlers.values()).sort((a, b) => b.wickets - a.wickets)[0];
  if (best1 && best1.wickets >= 4) {
    lines.push(`Day 2: ${best1.p.name} ripped through with ${best1.wickets}/${best1.runs}.`);
  }

  lines.push(`Innings 1: ${c.inn1.teamName} ${c.inn1.runs}${c.inn1.declared ? " dec" : ""}${c.inn1.wickets < 10 && !c.inn1.declared ? "/" + c.inn1.wickets : ""}.`);
  lines.push(`Innings 2: ${c.inn2.teamName} ${c.inn2.runs}${c.inn2.wickets < 10 ? "/" + c.inn2.wickets : ""}.`);

  if (c.followOnEnforced) {
    lines.push(`Day 3: Following on! ${c.secondBat.name} were asked to bat again after a heavy deficit.`);
  }

  const later = [...c.ourAll.slice(1), ...c.oppAll.slice(1)];
  for (const inn of later) {
    const t = [...inn.batters].sort((a, b) => b.runs - a.runs)[0];
    if (t && t.runs >= 80) lines.push(`Later innings: ${t.p.name} dug in for a battling ${t.runs}.`);
  }

  if (c.result === "DRAW") {
    lines.push(`Day 5 Final Session: Stumps drawn — a hard-fought draw.`);
  } else {
    lines.push(`Day 5: ${c.result === "WON" ? c.ourName : c.oppName} sealed it — ${c.marginText}.`);
  }
  lines.push(`Player of the Match: ${c.pom}. ${pick(["A performance the crowd will remember.", "A statement performance.", "Utterly commanding."], rng)}`);
  return lines;
}