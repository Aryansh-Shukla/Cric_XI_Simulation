import type { BatterLine, LimitedScorecard, MatchResult, StageKind, TestScorecard } from "./types";
import { KNOCKOUT_STAGES } from "./types";
import {
  advanceCut,
  netRunRate,
  phaseTable,
  type StandingRow,
  type TournamentState,
} from "./tournament";

/* ------------------------------------------------------------------ *
 * Read-only tournament analytics. Everything here is derived from the
 * canonical TournamentState (results, aiResults, standings, playerStats).
 * Nothing mutates state and nothing is random.
 * ------------------------------------------------------------------ */

const GROUP_STAGES: StageKind[] = ["League", "Group", "Super 8"];
export const isLimitedResult = (r: MatchResult): r is LimitedScorecard =>
  r.format === "T20" || r.format === "ODI";

/** Outcome of a user match from the user's point of view. */
export function outcomeOf(r: MatchResult): "W" | "L" | "D" {
  if (isLimitedResult(r)) return r.weWon ? "W" : "L";
  const t = r as TestScorecard;
  return t.result === "WON" ? "W" : t.result === "LOST" ? "L" : "D";
}

/** True when side "ourName" (team A in the scorecard) batted first. */
export function teamABattedFirst(r: LimitedScorecard): boolean {
  if (r.timeline?.[0]) return r.timeline[0].teamName === r.ourName;
  return (r.toss.winner === "us") === (r.toss.decision === "bat");
}

/* ---------------- Stage naming ---------------- */

export function stageLabel(stage: StageKind): string {
  if (stage === "League") return "League Stage";
  if (stage === "Group") return "Group Stage";
  return stage;
}

/** Accurate final-result label for a completed campaign. */
export function finalResultLabel(state: TournamentState): string {
  if (state.mode === "TEST") {
    if (state.wins > state.losses) return "Series Winner";
    if (state.wins < state.losses) return "Series Lost";
    return "Series Drawn";
  }
  if (state.championshipWon) return "Champion";
  const at = state.eliminatedAt ?? state.finalStageReached;
  if (at === "Final") return "Finalist";
  if (at === "Semi Final") return "Semifinalist";
  if (at === "Quarter Final") return "Quarterfinalist";
  return `Eliminated in ${stageLabel(at)}`;
}

/* ---------------- Around the tournament ---------------- */

export interface FeedItem {
  key: string;
  stage: StageKind;
  first: { name: string; score: string };
  second: { name: string; score: string };
  resultLine: string;
  standout?: string;
}

function inningsScore(runs: number, wickets: number, overs: number, maxOvers: number) {
  const w = wickets >= 10 ? "" : `/${wickets}`;
  return `${runs}${w}${overs < maxOvers || wickets >= 10 ? ` (${overs.toFixed(1)})` : ""}`;
}

/** Most recent completed AI-vs-AI results, newest first. */
export function aroundTheTournament(state: TournamentState, limit = 6): FeedItem[] {
  const out: FeedItem[] = [];
  for (let i = state.aiResults.length - 1; i >= 0 && out.length < limit; i--) {
    const r = state.aiResults[i];
    if (!isLimitedResult(r)) continue;
    const max = r.format === "T20" ? 20 : 50;
    const a = {
      name: r.ourName.replace(/ XI$/, ""),
      score: inningsScore(r.ourInnings.runs, r.ourInnings.wickets, r.ourInnings.overs, max),
    };
    const b = {
      name: r.oppName.replace(/ XI$/, ""),
      score: inningsScore(r.oppInnings.runs, r.oppInnings.wickets, r.oppInnings.overs, max),
    };
    const aFirst = teamABattedFirst(r);
    const top =
      r.ourInnings.topScorer.runs >= r.oppInnings.topScorer.runs
        ? r.ourInnings.topScorer
        : r.oppInnings.topScorer;
    const bb =
      r.ourInnings.bestBowler.wickets >= r.oppInnings.bestBowler.wickets
        ? r.ourInnings.bestBowler
        : r.oppInnings.bestBowler;
    const standout =
      bb.wickets >= 4
        ? `${bb.name} ${bb.wickets}/${bb.runs}`
        : top.runs >= 50
          ? `${top.name} ${top.runs} (${top.balls})`
          : undefined;
    out.push({
      key: `ai-${i}`,
      stage: r.stage,
      first: aFirst ? a : b,
      second: aFirst ? b : a,
      resultLine: r.resultLine.replace(/ XI\b/g, ""),
      standout,
    });
  }
  return out;
}

/* ---------------- Qualification ---------------- */

export type QualTone = "good" | "warn" | "bad" | "neutral";
export interface QualificationStatus {
  headline: string;
  detail: string;
  tone: QualTone;
}

/** Remaining fixtures (ours) in the group phase currently being played. */
function remainingInPhase(state: TournamentState): number {
  if (!state.phaseStage) return 0;
  let n = 0;
  for (let i = state.currentIndex; i < state.fixtures.length; i++) {
    if (state.fixtures[i].stage === state.phaseStage) n++;
    else break;
  }
  return n;
}

/**
 * Qualification picture from the canonical phase table. Every team plays at
 * most one game per matchday, so "points + 2 × remaining matchdays" is a strict
 * upper bound — the guarantees below are mathematically safe; anything that
 * depends on ties is reported as "NRR could decide this", never as a margin.
 */
export function qualificationStatus(state: TournamentState): QualificationStatus | null {
  if (state.mode === "TEST") return testSeriesStatus(state);
  if (state.complete) return null;
  const next = state.fixtures[state.currentIndex];
  if (!next) return null;

  if ((KNOCKOUT_STAGES as string[]).includes(next.stage)) return knockoutStatus(state, next.stage);
  if (!GROUP_STAGES.includes(next.stage)) return null;

  // Brand-new phase (e.g. first Super 8 game): table not yet populated.
  if (state.phaseStage !== next.stage) {
    const cut = advanceCut(state.mode, next.stage);
    return {
      headline: `${stageLabel(next.stage)} begins`,
      detail: `Top ${cut} advance. Every team starts on zero points.`,
      tone: "neutral",
    };
  }

  const table = phaseTable(state);
  const ours = table.find((r) => r.isOurs);
  if (!ours) return null;
  const R = remainingInPhase(state);
  const cut = advanceCut(state.mode, next.stage);
  const others = table.filter((r) => !r.isOurs);
  const ourMax = ours.points + 2 * R;
  const advanceTo =
    state.mode === "FRANCHISE_T20"
      ? "the playoffs"
      : state.mode === "T20_WC" && next.stage === "Group"
        ? "the Super 8"
        : "the semi-finals";

  // Teams already strictly beyond our reach.
  const beyondReach = others.filter((r) => r.points > ourMax).length;
  if (beyondReach >= cut)
    return {
      headline: "Out of contention",
      detail: `${cut} teams can no longer be caught on points.`,
      tone: "bad",
    };
  // Teams that could still finish level or above us even if we lose out.
  const threats = others.filter((r) => r.points + 2 * R >= ours.points).length;
  if (threats < cut)
    return {
      headline: "Qualification secured",
      detail: `${state.ourName} are guaranteed a place in ${advanceTo}.`,
      tone: "good",
    };
  // If we win every remaining game, how many could still sit level or above?
  const threatsIfWinOut = others.filter((r) => r.points + 2 * R >= ourMax).length;
  const strictAboveIfWinOut = others.filter((r) => r.points + 2 * R > ourMax).length;
  // Must-win: losing the next game leaves cut teams strictly out of reach.
  const ifLoseNextMax = ours.points + 2 * (R - 1);
  const mustWin = others.filter((r) => r.points > ifLoseNextMax).length >= cut;
  const rank = table.indexOf(ours) + 1;
  const boundary = table[cut - 1];
  const nrrLive = !!boundary && boundary.points === ours.points && R <= 2;

  if (mustWin)
    return {
      headline: "Must win to stay alive",
      detail:
        R === 1
          ? "Lose the last group game and the campaign is over."
          : "Another defeat would leave too many teams out of reach.",
      tone: "bad",
    };
  if (threatsIfWinOut < cut && R === 1)
    return {
      headline: "One win from qualification",
      detail: `Win the final game and ${advanceTo} awaits.`,
      tone: "good",
    };
  if (nrrLive)
    return {
      headline: "Net run rate could decide this",
      detail: `Level on points with the side in ${ordinal(cut)}. Margins matter now.`,
      tone: "warn",
    };
  return {
    headline: rank <= cut ? `${ordinal(rank)} — inside the top ${cut}` : `${ordinal(rank)} — chasing the top ${cut}`,
    detail:
      strictAboveIfWinOut === 0 && threatsIfWinOut >= cut
        ? `${R} game${R === 1 ? "" : "s"} left. Winning out may still come down to NRR.`
        : `${R} group game${R === 1 ? "" : "s"} left.`,
    tone: rank <= cut ? "good" : "warn",
  };
}

function knockoutStatus(state: TournamentState, stage: StageKind): QualificationStatus {
  switch (stage) {
    case "Final":
      return {
        headline: "The Final",
        detail: "One match for the title.",
        tone: "good",
      };
    case "Semi Final":
      return { headline: "Semi-final", detail: "Win and the Final awaits. Lose and it's over.", tone: "warn" };
    case "Qualifier 1":
      return {
        headline: "Qualifier 1",
        detail: "Win for a direct Final spot. A loss sends you to Qualifier 2.",
        tone: "good",
      };
    case "Qualifier 2":
      return { headline: "Qualifier 2", detail: "Winner goes to the Final. Loser goes home.", tone: "warn" };
    case "Eliminator":
      return { headline: "Eliminator", detail: "Knockout — win to reach Qualifier 2.", tone: "warn" };
    default:
      return { headline: stage, detail: "Knockout match.", tone: "warn" };
  }
}

function testSeriesStatus(state: TournamentState): QualificationStatus {
  const total = state.fixtures.length;
  const played = state.results.length;
  const left = total - played;
  const { wins: w, losses: l } = state;
  const opp = state.fixtures[0]?.opponent.name.replace(/ XI$/, "") ?? "Opposition";
  if (state.complete)
    return {
      headline: w > l ? "Series won" : w < l ? "Series lost" : "Series drawn",
      detail: `${w}–${l} with ${state.draws} draw${state.draws === 1 ? "" : "s"}.`,
      tone: w > l ? "good" : w < l ? "bad" : "neutral",
    };
  if (played === 0)
    return { headline: `${total}-Test series`, detail: `Against ${opp}. Series level 0–0.`, tone: "neutral" };
  if (w - l > left)
    return { headline: "Series secured", detail: `${w}–${l} with ${left} to play — the series is yours.`, tone: "good" };
  if (l - w > left)
    return { headline: "Series lost", detail: `${w}–${l} with ${left} to play — playing for pride.`, tone: "bad" };
  if (l - w === left)
    return { headline: "Must win to draw the series", detail: `Trailing ${w}–${l} with ${left} to play.`, tone: "bad" };
  return {
    headline: w > l ? `Leading ${w}–${l}` : w < l ? `Trailing ${w}–${l}` : `Series level ${w}–${l}`,
    detail: `${left} Test${left === 1 ? "" : "s"} remaining.`,
    tone: w >= l ? "neutral" : "warn",
  };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------------- Table context ---------------- */

export interface TableRowContext {
  row: StandingRow;
  rank: number;
  nrr: number;
  movement: number; // + moved up since last matchday
  remaining: number;
  status: "Q" | "E" | null;
}

/** Phase table with movement vs. the previous matchday and clinched/eliminated flags. */
export function tableContext(state: TournamentState, prev: TournamentState | null): TableRowContext[] {
  const rows = phaseTable(state);
  const prevRows = prev && prev.phaseStage === state.phaseStage ? phaseTable(prev) : [];
  const R = state.complete ? 0 : remainingInPhase(state);
  const cut = state.phaseStage ? advanceCut(state.mode, state.phaseStage) : 4;
  const phaseOver = !state.fixtures[state.currentIndex] || state.fixtures[state.currentIndex].stage !== state.phaseStage;
  return rows.map((row, i) => {
    const before = prevRows.findIndex((r) => r.name === row.name);
    const others = rows.filter((r) => r !== row);
    let status: "Q" | "E" | null = null;
    if (phaseOver) status = i < cut ? "Q" : "E";
    else {
      if (others.filter((r) => r.points + 2 * R >= row.points).length < cut) status = "Q";
      else if (others.filter((r) => r.points > row.points + 2 * R).length >= cut) status = "E";
    }
    return {
      row,
      rank: i + 1,
      nrr: netRunRate(row),
      movement: before < 0 ? 0 : before - i,
      remaining: R,
      status,
    };
  });
}

/* ---------------- Records ---------------- */

export interface RecordItem {
  label: string;
  value: string;
  who: string;
  isOurs: boolean;
}

interface Tagged {
  r: MatchResult;
  user: boolean;
}
function allResults(state: TournamentState): Tagged[] {
  return [
    ...state.results.map((r) => ({ r, user: true })),
    ...state.aiResults.map((r) => ({ r, user: false })),
  ];
}
const clean = (s: string) => s.replace(/ XI$/, "");

export function tournamentRecords(state: TournamentState): RecordItem[] {
  let hs: { b: BatterLine; team: string; ours: boolean } | null = null;
  let bb: { name: string; w: number; r: number; team: string; ours: boolean } | null = null;
  let tt: { runs: number; wk: number; team: string; ours: boolean } | null = null;
  let chase: { runs: number; wk: number; team: string; ours: boolean } | null = null;
  let pship: { runs: number; names: [string, string]; team: string; ours: boolean } | null = null;

  for (const { r, user } of allResults(state)) {
    for (const inn of r.full ?? []) {
      const batOurs = user && inn.teamName === r.ourName;
      const bowlTeam = inn.teamName === r.ourName ? r.oppName : r.ourName;
      for (const b of inn.batters)
        if (!hs || b.runs > hs.b.runs || (b.runs === hs.b.runs && b.balls < hs.b.balls))
          hs = { b, team: inn.teamName, ours: batOurs };
      for (const bw of inn.bowlers)
        if (!bb || bw.wickets > bb.w || (bw.wickets === bb.w && bw.runs < bb.r))
          bb = { name: bw.name, w: bw.wickets, r: bw.runs, team: bowlTeam, ours: user && bowlTeam === r.ourName };
      if (!tt || inn.runs > tt.runs) tt = { runs: inn.runs, wk: inn.wickets, team: inn.teamName, ours: batOurs };
    }
    const sides = isLimitedResult(r) ? [r.ourInnings, r.oppInnings] : [...r.ourInnings, ...r.oppInnings];
    for (const s of sides)
      if (s.partnership && (!pship || s.partnership.runs > pship.runs))
        pship = {
          runs: s.partnership.runs,
          names: s.partnership.names,
          team: s.teamName,
          ours: user && s.teamName === r.ourName,
        };
    if (isLimitedResult(r) && !r.superOver) {
      const aFirst = teamABattedFirst(r);
      const chaserIsA = !aFirst;
      const chaserWon = chaserIsA === r.weWon;
      if (chaserWon) {
        const inn = chaserIsA ? r.ourInnings : r.oppInnings;
        if (!chase || inn.runs > chase.runs)
          chase = { runs: inn.runs, wk: inn.wickets, team: inn.teamName, ours: user && chaserIsA };
      }
    }
  }
  const out: RecordItem[] = [];
  if (hs && hs.b.runs > 0)
    out.push({
      label: "Highest Score",
      value: `${hs.b.runs}${hs.b.out ? "" : "*"} (${hs.b.balls})`,
      who: `${hs.b.name} · ${clean(hs.team)}`,
      isOurs: hs.ours,
    });
  if (bb && bb.w > 0)
    out.push({ label: "Best Bowling", value: `${bb.w}/${bb.r}`, who: `${bb.name} · ${clean(bb.team)}`, isOurs: bb.ours });
  if (pship && pship.runs > 0)
    out.push({
      label: "Best Partnership",
      value: `${pship.runs}`,
      who: `${pship.names[0]} & ${pship.names[1]} · ${clean(pship.team)}`,
      isOurs: pship.ours,
    });
  if (tt)
    out.push({ label: "Best Team Total", value: `${tt.runs}/${tt.wk}`, who: clean(tt.team), isOurs: tt.ours });
  if (chase)
    out.push({ label: "Best Chase", value: `${chase.runs}/${chase.wk}`, who: clean(chase.team), isOurs: chase.ours });
  return out;
}

/* ---------------- User campaign summary ---------------- */

export interface CampaignSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  streak: string;
  runsFor: number;
  runsAgainst: number;
  nrr: number | null;
  topBatter?: { name: string; runs: number };
  topBowler?: { name: string; wickets: number };
  bestInnings?: { name: string; runs: number; balls: number; notOut: boolean; vs: string };
  bestBowling?: { name: string; wickets: number; runs: number; vs: string };
}

export function currentStreak(results: MatchResult[]): { kind: "W" | "L" | "D"; n: number } | null {
  if (!results.length) return null;
  const kind = outcomeOf(results[results.length - 1]);
  let n = 0;
  for (let i = results.length - 1; i >= 0 && outcomeOf(results[i]) === kind; i--) n++;
  return { kind, n };
}

export function campaignSummary(state: TournamentState): CampaignSummary {
  let runsFor = 0;
  let runsAgainst = 0;
  let bestInnings: CampaignSummary["bestInnings"];
  let bestBowling: CampaignSummary["bestBowling"];
  for (const r of state.results) {
    if (isLimitedResult(r)) {
      runsFor += r.ourInnings.runs;
      runsAgainst += r.oppInnings.runs;
    } else {
      for (const i of r.ourInnings) runsFor += i.runs;
      for (const i of r.oppInnings) runsAgainst += i.runs;
    }
    const vs = clean(r.oppName);
    for (const inn of r.full ?? []) {
      if (inn.teamName === r.ourName) {
        for (const b of inn.batters)
          if (!bestInnings || b.runs > bestInnings.runs)
            bestInnings = { name: b.name, runs: b.runs, balls: b.balls, notOut: !b.out, vs };
      } else {
        for (const bw of inn.bowlers)
          if (!bestBowling || bw.wickets > bestBowling.wickets || (bw.wickets === bestBowling.wickets && bw.runs < bestBowling.runs))
            bestBowling = { name: bw.name, wickets: bw.wickets, runs: bw.runs, vs };
      }
    }
  }
  const ours = Object.values(state.playerStats).filter((p) => p.isOurs && p.team === state.ourName);
  const bat = [...ours].sort((a, b) => b.runs - a.runs)[0];
  const bowl = [...ours].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];
  const row = Object.values(state.standings).find((r) => r.isOurs);
  const s = currentStreak(state.results);
  return {
    played: state.results.length,
    wins: state.wins,
    losses: state.losses,
    draws: state.draws,
    streak: s ? `${s.kind}${s.n}` : "—",
    runsFor,
    runsAgainst,
    nrr: row ? netRunRate(row) : null,
    topBatter: bat && bat.runs > 0 ? { name: bat.name, runs: bat.runs } : undefined,
    topBowler: bowl && bowl.wickets > 0 ? { name: bowl.name, wickets: bowl.wickets } : undefined,
    bestInnings: bestInnings && bestInnings.runs > 0 ? bestInnings : undefined,
    bestBowling: bestBowling && bestBowling.wickets > 0 ? bestBowling : undefined,
  };
}

export function formatNrr(n: number): string {
  return n > 0 ? `+${n.toFixed(3)}` : n.toFixed(3);
}
