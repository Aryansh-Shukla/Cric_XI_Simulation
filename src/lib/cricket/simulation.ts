import type {
  Player, GameMode, MatchResult, LimitedScorecard, StageKind,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";
import { CHEMISTRY, SQUADS_BY_MODE } from "./data";
import { pickCaptain } from "./rules";
import { computeTeamRating, overall } from "./rating";
import { mulberry32, childRng, type Rng } from "./sim/rng";
import { simulateLimitedMatch, type Opponent } from "./sim/limited";
import { simulateTestMatch } from "./sim/test";

function chemistryBonus(players: Player[]): { total: number; activated: { label: string; pair: string }[] } {
  const names = new Set(players.map(p => p.name));
  const activated: { label: string; pair: string }[] = [];
  let total = 0;
  for (const link of CHEMISTRY) {
    if (names.has(link.a) && names.has(link.b)) {
      total += 3;
      activated.push({ label: link.label, pair: `${link.a} × ${link.b}` });
    }
  }
  return { total, activated };
}

export function teamStrength(players: Player[]) {
  if (!players.length) return 60;
  return computeTeamRating(players).overall;
}

export type { Opponent } from "./sim/limited";

export function generateOpponents(mode: GameMode, rng: Rng, count = 3): Opponent[] {
  const pool = SQUADS_BY_MODE[mode];
  const opps: Opponent[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let squad = pool[Math.floor(rng() * pool.length)];
    let tries = 0;
    while (used.has(squad.id) && tries++ < 10) {
      squad = pool[Math.floor(rng() * pool.length)];
    }
    used.add(squad.id);
    const eleven = [...squad.players]
      .sort((a, b) => overall(b) - overall(a))
      .slice(0, 11);
    opps.push({
      name: `${squad.label} XI`,
      rating: teamStrength(eleven),
      players: eleven,
    });
  }
  return opps;
}

/* ---------- Tournament structures ---------- */

function stagesFor(mode: GameMode): StageKind[] {
  switch (mode) {
    case "ODI_WC":        return ["League", "League", "League", "Semi Final", "Final"];
    case "T20_WC":        return ["Group", "Group", "Super 8", "Super 8", "Semi Final", "Final"];
    case "CHAMPIONS":     return ["Group", "Group", "Semi Final", "Final"];
    case "FRANCHISE_T20": return ["League", "League", "League", "League", "Qualifier 1", "Qualifier 2", "Final"];
    case "TEST":          return ["Test 1", "Test 2", "Test 3"];
  }
}

export interface Tournament {
  results: MatchResult[];
  stages: StageKind[];        // planned schedule
  championshipWon: boolean;
  eliminated: boolean;
  eliminatedAt?: StageKind;
  finalStageReached: StageKind;
  wins: number;
  losses: number;
  draws: number;
  captain: Player;
  seed: number;
  mode: GameMode;
  teamRatingSnapshot: number;
  finalScore: number;         // leaderboard score
  seriesResult?: string;      // for TEST
  playerOfSeries?: string;    // for TEST
}

export function simulateTournament(
  players: Player[],
  mode: GameMode,
  seed = Date.now(),
  captainId?: string,
  ourName = "Your XI",
): Tournament {
  const rng = mulberry32(seed);
  const captain = (captainId && players.find(p => p.id === captainId)) || pickCaptain(players);
  const stages = stagesFor(mode);
  const opponents = generateOpponents(mode, rng, stages.length);
  const ratingSnapshot = computeTeamRating(players).overall;
  const chem = chemistryBonus(players).total;

  const results: MatchResult[] = [];
  let wins = 0, losses = 0, draws = 0;
  let eliminated = false;
  let eliminatedAt: StageKind | undefined;
  let finalStageReached: StageKind = stages[0];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    finalStageReached = stage;
    const opp = opponents[i % opponents.length];
    const matchRng = childRng(rng);

    if (mode === "TEST") {
      const t = simulateTestMatch(ourName, players, opp, stage, matchRng, captain);
      results.push(t);
      if (t.result === "WON") wins++; else if (t.result === "LOST") losses++; else draws++;
      continue;
    }

    // Franchise Qualifier 2 branch: skip if we won Q1
    if (mode === "FRANCHISE_T20" && stage === "Qualifier 2") {
      const q1 = results[results.length - 1];
      if (q1 && "weWon" in q1 && q1.weWon) continue;
      if (q1 && "weWon" in q1 && !q1.weWon && eliminated) {
        // already eliminated in Q1? no, Q1 loss goes to Q2 in IPL rules
      }
    }

    const m = simulateLimitedMatch(ourName, players, opp, mode, stage, matchRng, chem);
    results.push(m);
    if (m.weWon) wins++; else losses++;

    // Elimination logic
    if (!m.weWon) {
      // Special: Qualifier 1 loss does NOT eliminate — drops to Qualifier 2
      if (mode === "FRANCHISE_T20" && stage === "Qualifier 1") {
        // continue to Q2
      } else if ((KNOCKOUT_STAGES as string[]).includes(stage)) {
        eliminated = true;
        eliminatedAt = stage;
        break;
      }
    }

    // League/Group qualification cutoff:
    // After the last league/group/super8 stage, check win rate
    const nextStage = stages[i + 1];
    const groupStages: StageKind[] = ["League", "Group", "Super 8"];
    if (groupStages.includes(stage) && (!nextStage || !groupStages.includes(nextStage))) {
      const groupResults = results.filter(r => "weWon" in r && groupStages.includes(r.stage));
      const groupWins = groupResults.filter(r => "weWon" in r && (r as LimitedScorecard).weWon).length;
      const needed = Math.ceil(groupResults.length / 2);
      if (groupWins < needed) {
        eliminated = true;
        eliminatedAt = stage;
        break;
      }
    }
  }

  const championshipWon = !eliminated && (() => {
    const last = results[results.length - 1];
    if (!last) return false;
    if ("weWon" in last) return last.weWon && last.stage === "Final";
    // Test series: majority wins
    return wins > losses;
  })();

  // Series/Player-of-series for TEST
  let seriesResult: string | undefined;
  let playerOfSeries: string | undefined;
  if (mode === "TEST") {
    seriesResult = `${ourName} ${wins} — ${losses} ${opponents[0].name.replace(" XI", "")} (${draws} draw${draws === 1 ? "" : "s"})`;
    const potPool = wins >= losses ? players : opponents[0].players;
    playerOfSeries = [...potPool].sort((a, b) => (b.stats.batting + b.stats.bowling) - (a.stats.batting + a.stats.bowling))[0].name;
  }

  // Leaderboard scoring
  const stageBonus: Record<string, number> = {
    "Group": 5, "League": 5, "Super 8": 10, "Quarter Final": 15,
    "Semi Final": 25, "Qualifier 1": 20, "Qualifier 2": 15, "Eliminator": 15,
    "Final": 40, "Test 1": 15, "Test 2": 15, "Test 3": 15,
  };
  const finalScore = Math.round(
    ratingSnapshot * 3
    + wins * 12
    - losses * 4
    + (championshipWon ? 100 : 0)
    + (stageBonus[finalStageReached] ?? 0)
  );

  return {
    results,
    stages,
    championshipWon,
    eliminated,
    eliminatedAt,
    finalStageReached,
    wins, losses, draws,
    captain,
    seed,
    mode,
    teamRatingSnapshot: ratingSnapshot,
    finalScore,
    seriesResult,
    playerOfSeries,
  };
}

export function activatedChemistry(players: Player[]) {
  return chemistryBonus(players).activated;
}