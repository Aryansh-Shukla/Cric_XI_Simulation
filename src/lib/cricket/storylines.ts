import type { LimitedScorecard, MatchResult } from "./types";
import { KNOCKOUT_STAGES } from "./types";
import type { TournamentState } from "./tournament";
import { currentStreak, isLimitedResult, outcomeOf, teamABattedFirst } from "./campaign";
import { topRunScorers, topWicketTakers } from "./tournament";

/* ------------------------------------------------------------------ *
 * Deterministic storyline detection. Every storyline is backed by real
 * completed results; nothing is random and nothing is generated text.
 * ------------------------------------------------------------------ */

export type StorylineType =
  | "UNBEATEN"
  | "WINNING_STREAK"
  | "LOSING_STREAK"
  | "COMEBACK"
  | "DOMINANT_START"
  | "TABLE_TOPPERS"
  | "QUALIFIED"
  | "ELIMINATED"
  | "FINAL_APPEARANCE"
  | "CHAMPIONS"
  | "LEADING_RUNS"
  | "LEADING_WICKETS"
  | "CENTURY"
  | "FIVE_FOR"
  | "CLOSE_FINISH"
  | "UPSET";

export interface Storyline {
  id: string;
  type: StorylineType;
  scope: "campaign" | "player" | "match";
  priority: number; // higher shows first
  title: string;
  description: string;
}

/** Parses "won by 6 runs" / "won by 3 wickets" from a result line. */
function margin(r: LimitedScorecard): { runs?: number; wickets?: number } {
  const m = /by (\d+) (run|wicket)/.exec(r.marginText || r.resultLine);
  if (!m) return {};
  return m[2] === "run" ? { runs: Number(m[1]) } : { wickets: Number(m[1]) };
}

function isClose(r: LimitedScorecard): boolean {
  if (r.superOver) return true;
  const m = margin(r);
  return (
    (m.runs !== undefined && m.runs <= (r.format === "T20" ? 6 : 12)) ||
    (m.wickets !== undefined && m.wickets <= 2)
  );
}

const clean = (s: string) => s.replace(/ XI$/, "");

export function detectStorylines(state: TournamentState): Storyline[] {
  const out: Storyline[] = [];
  const res = state.results;
  const name = state.ourName;
  const streak = currentStreak(res);

  // ---- campaign ----
  if (state.championshipWon)
    out.push({
      id: "champions",
      type: "CHAMPIONS",
      scope: "campaign",
      priority: 100,
      title: state.mode === "TEST" ? "Series winners" : "Champions",
      description: `${name} finished the job with a ${state.wins}–${state.losses} record.`,
    });
  if (state.eliminated)
    out.push({
      id: "eliminated",
      type: "ELIMINATED",
      scope: "campaign",
      priority: 95,
      title: `Out at the ${state.eliminatedAt}`,
      description: `The campaign ended with a ${state.wins}–${state.losses} record.`,
    });
  const reachedFinal = state.fixtures.findIndex((f) => f.stage === "Final");
  if (
    !state.championshipWon &&
    reachedFinal >= 0 &&
    reachedFinal <= state.currentIndex &&
    state.mode !== "TEST" &&
    (state.currentIndex === reachedFinal || state.results[reachedFinal])
  )
    out.push({
      id: "final",
      type: "FINAL_APPEARANCE",
      scope: "campaign",
      priority: 90,
      title: "Into the Final",
      description: `${name} have reached the title decider.`,
    });
  if (res.length >= 3 && state.losses === 0 && state.draws === 0)
    out.push({
      id: "unbeaten",
      type: "UNBEATEN",
      scope: "campaign",
      priority: 80,
      title: `Unbeaten in ${res.length}`,
      description: `${name} have won every match so far.`,
    });
  else if (streak && streak.kind === "W" && streak.n >= 3)
    out.push({
      id: `wstreak-${streak.n}`,
      type: "WINNING_STREAK",
      scope: "campaign",
      priority: 70,
      title: `${streak.n} straight wins`,
      description: `${name} have won their last ${streak.n} matches.`,
    });
  if (streak && streak.kind === "L" && streak.n >= 2)
    out.push({
      id: `lstreak-${streak.n}`,
      type: "LOSING_STREAK",
      scope: "campaign",
      priority: 72,
      title: `${streak.n} defeats in a row`,
      description: `${name} need to stop the slide.`,
    });
  // Comeback: lost at least one of the first two, then won 2+ straight since.
  if (
    res.length >= 3 &&
    res.slice(0, 2).some((r) => outcomeOf(r) === "L") &&
    streak?.kind === "W" &&
    streak.n >= 2
  )
    out.push({
      id: "comeback",
      type: "COMEBACK",
      scope: "campaign",
      priority: 68,
      title: "Recovered after an early loss",
      description: `An early defeat, then ${streak.n} wins on the bounce.`,
    });
  if (res.length === 2 && res.every((r) => outcomeOf(r) === "W"))
    out.push({
      id: "dominant-start",
      type: "DOMINANT_START",
      scope: "campaign",
      priority: 50,
      title: "Perfect start",
      description: "Two from two to open the campaign.",
    });
  if (state.qualifiedRank !== undefined && !state.eliminated && state.mode !== "TEST")
    out.push({
      id: `qualified-${state.qualifiedRank}`,
      type: "QUALIFIED",
      scope: "campaign",
      priority: 75,
      title: `Qualified in ${state.qualifiedRank === 1 ? "1st" : state.qualifiedRank === 2 ? "2nd" : state.qualifiedRank === 3 ? "3rd" : `${state.qualifiedRank}th`}`,
      description: "Through to the next stage on the points table.",
    });

  // ---- players (tournament-wide leaderboards) ----
  const topBat = topRunScorers(state, 1)[0];
  if (topBat && res.length >= 2)
    out.push({
      id: `runs-${topBat.team}-${topBat.name}`,
      type: "LEADING_RUNS",
      scope: "player",
      priority: topBat.isOurs ? 62 : 40,
      title: `${topBat.name} leads the run charts`,
      description: `${topBat.runs} runs for ${clean(topBat.team)}.`,
    });
  const topBowl = topWicketTakers(state, 1)[0];
  if (topBowl && res.length >= 2)
    out.push({
      id: `wkts-${topBowl.team}-${topBowl.name}`,
      type: "LEADING_WICKETS",
      scope: "player",
      priority: topBowl.isOurs ? 61 : 39,
      title: `${topBowl.name} tops the wicket list`,
      description: `${topBowl.wickets} wickets for ${clean(topBowl.team)}.`,
    });

  // ---- latest user match ----
  const last: MatchResult | undefined = res[res.length - 1];
  if (last) {
    for (const inn of last.full ?? []) {
      if (inn.teamName !== last.ourName) continue;
      const ton = inn.batters.find((b) => b.runs >= 100);
      if (ton)
        out.push({
          id: `ton-${res.length}-${ton.name}`,
          type: "CENTURY",
          scope: "player",
          priority: 66,
          title: `Hundred for ${ton.name}`,
          description: `${ton.runs}${ton.out ? "" : "*"} off ${ton.balls} vs ${clean(last.oppName)}.`,
        });
    }
    for (const inn of last.full ?? []) {
      if (inn.teamName === last.ourName) continue;
      const five = inn.bowlers.find((b) => b.wickets >= 5);
      if (five)
        out.push({
          id: `five-${res.length}-${five.name}`,
          type: "FIVE_FOR",
          scope: "player",
          priority: 65,
          title: `Five-for for ${five.name}`,
          description: `${five.wickets}/${five.runs} vs ${clean(last.oppName)}.`,
        });
    }
    if (isLimitedResult(last) && isClose(last))
      out.push({
        id: `close-${res.length}`,
        type: "CLOSE_FINISH",
        scope: "match",
        priority: 55,
        title: last.superOver ? "Decided by a Super Over" : "Nail-biter",
        description: last.resultLine.replace(/ XI\b/g, ""),
      });
  }

  // ---- around the tournament: latest upset among AI matches ----
  const ratings = new Map(state.field.map((o) => [o.name, o.rating]));
  for (let i = state.aiResults.length - 1; i >= Math.max(0, state.aiResults.length - 4); i--) {
    const r = state.aiResults[i];
    if (!isLimitedResult(r)) continue;
    const winner = r.weWon ? r.ourName : r.oppName;
    const loser = r.weWon ? r.oppName : r.ourName;
    const gap = (ratings.get(loser) ?? 0) - (ratings.get(winner) ?? 0);
    if (gap >= 4) {
      out.push({
        id: `upset-${i}`,
        type: "UPSET",
        scope: "match",
        priority: 35,
        title: `Upset: ${clean(winner)} beat ${clean(loser)}`,
        description: r.resultLine.replace(/ XI\b/g, ""),
      });
      break;
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/* ---------------- Story moments (state transitions) ---------------- */

export interface StoryMoment {
  id: string;
  title: string;
  subtitle: string;
  tone: "gold" | "accent" | "muted";
}

/**
 * Detects a single headline moment caused by the transition prev → next.
 * Keyed by result count so the same moment is never shown twice.
 */
export function detectMoment(prev: TournamentState, next: TournamentState): StoryMoment | null {
  if (next.results.length === prev.results.length) return null;
  const n = next.results.length;
  const last = next.results[n - 1];
  if (next.complete) {
    if (next.championshipWon)
      return {
        id: `m-${n}`,
        title: next.mode === "TEST" ? "SERIES WON" : "CHAMPIONS",
        subtitle: `${next.ourName} finish ${next.wins}–${next.losses}.`,
        tone: "gold",
      };
    return {
      id: `m-${n}`,
      title: "TOURNAMENT OVER",
      subtitle: next.eliminated
        ? `Knocked out at the ${next.eliminatedAt}.`
        : (next.seriesResult ?? ""),
      tone: "muted",
    };
  }
  const upcoming = next.fixtures[next.currentIndex]?.stage;
  if (upcoming === "Final" && prev.fixtures[prev.currentIndex]?.stage !== "Final")
    return {
      id: `m-${n}`,
      title: "THE FINAL AWAITS",
      subtitle: `${next.ourName} are one win from the title.`,
      tone: "gold",
    };
  if (next.qualifiedRank !== undefined && prev.qualifiedRank === undefined) {
    const label =
      upcoming === "Semi Final"
        ? "SEMIFINAL BOUND"
        : upcoming === "Super 8"
          ? "INTO THE SUPER 8"
          : "QUALIFIED";
    return {
      id: `m-${n}`,
      title: label,
      subtitle: `Finished ${next.qualifiedRank} on the table.`,
      tone: "accent",
    };
  }
  if (upcoming === "Semi Final" && prev.fixtures[prev.currentIndex]?.stage !== "Semi Final")
    return {
      id: `m-${n}`,
      title: "SEMIFINAL BOUND",
      subtitle: "Win and the Final awaits.",
      tone: "accent",
    };
  const streak = currentStreak(next.results);
  if (outcomeOf(last) === "W" && prev.results.length >= 2) {
    const prevStreak = currentStreak(prev.results);
    if (prevStreak && prevStreak.kind === "L" && prevStreak.n >= 2)
      return {
        id: `m-${n}`,
        title: "WHAT A COMEBACK",
        subtitle: `A win ends a ${prevStreak.n}-match slide.`,
        tone: "accent",
      };
  }
  if (streak && streak.kind === "W" && (streak.n === 3 || streak.n === 5))
    return {
      id: `m-${n}`,
      title: streak.n === 3 ? "THREE STRAIGHT WINS" : "FIVE IN A ROW",
      subtitle: `${next.ourName} are rolling.`,
      tone: "gold",
    };
  if (
    isLimitedResult(last) &&
    last.weWon &&
    (KNOCKOUT_STAGES as string[]).includes(last.stage) &&
    last.superOver
  )
    return { id: `m-${n}`, title: "SUPER OVER WIN", subtitle: last.resultLine, tone: "gold" };
  // Successful high chase in the latest match.
  if (
    isLimitedResult(last) &&
    last.weWon &&
    !teamABattedFirst(last) &&
    last.oppInnings.runs >= (last.format === "T20" ? 190 : 320)
  )
    return {
      id: `m-${n}`,
      title: "WHAT A CHASE",
      subtitle: `${last.oppInnings.runs} hunted down.`,
      tone: "accent",
    };
  return null;
}
