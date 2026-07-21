import type {
  Player, GameMode, MatchResult, StageKind, LimitedScorecard, TestScorecard,
  PlayerAgg, FullInnings,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";
import { SQUADS_BY_MODE, CHEMISTRY } from "./data";
import { pickCaptain } from "./rules";
import { computeTeamRating, overall } from "./rating";
import { mulberry32, childRng, type Rng } from "./sim/rng";
import { simulateLimitedMatch, type Opponent } from "./sim/limited";
import { simulateTestMatch } from "./sim/test";

function stagesFor(mode: GameMode): StageKind[] {
  switch (mode) {
    case "ODI_WC":        return ["League", "League", "League", "Semi Final", "Final"];
    case "T20_WC":        return ["Group", "Group", "Super 8", "Super 8", "Semi Final", "Final"];
    case "CHAMPIONS":     return ["Group", "Group", "Semi Final", "Final"];
    case "FRANCHISE_T20": return ["League", "League", "League", "League", "Qualifier 1", "Qualifier 2", "Final"];
    case "TEST":          return ["Test 1", "Test 2", "Test 3"];
  }
}

function chemistryBonus(players: Player[]): number {
  const names = new Set(players.map(p => p.name));
  let total = 0;
  for (const link of CHEMISTRY) if (names.has(link.a) && names.has(link.b)) total += 3;
  return total;
}

function buildOpponents(mode: GameMode, rng: Rng, count: number): Opponent[] {
  const pool = SQUADS_BY_MODE[mode];
  const out: Opponent[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let squad = pool[Math.floor(rng() * pool.length)];
    let tries = 0;
    while (used.has(squad.id) && tries++ < 20 && pool.length > used.size) {
      squad = pool[Math.floor(rng() * pool.length)];
    }
    used.add(squad.id);
    const eleven = [...squad.players].sort((a, b) => overall(b) - overall(a)).slice(0, 11);
    const rating = computeTeamRating(eleven).overall;
    out.push({ name: `${squad.label} XI`, rating, players: eleven });
  }
  return out;
}

export interface Fixture {
  stage: StageKind;
  opponent: Opponent;
  aiA?: Opponent;
  aiB?: Opponent;
}

export interface TournamentState {
  mode: GameMode;
  ourName: string;
  players: Player[];
  captain: Player;
  seed: number;
  stages: StageKind[];
  fixtures: Fixture[];
  currentIndex: number;      // index of NEXT match to play
  results: MatchResult[];    // user matches (in order)
  aiResults: MatchResult[];  // AI-vs-AI matches (for stats/standings)
  wins: number; losses: number; draws: number;
  eliminated: boolean;
  eliminatedAt?: StageKind;
  championshipWon: boolean;
  complete: boolean;
  teamRatingSnapshot: number;
  chemistryBonus: number;
  finalStageReached: StageKind;
  seriesResult?: string;
  playerOfSeries?: string;
  finalScore: number;
  playerStats: Record<string, PlayerAgg>;
  aiSeed: number;
}

export function createTournament(
  players: Player[],
  mode: GameMode,
  seed = Date.now(),
  captainId?: string,
  ourName = "Your XI",
): TournamentState {
  const rng = mulberry32(seed);
  const captain = (captainId && players.find(p => p.id === captainId)) || pickCaptain(players);
  const stages = stagesFor(mode);
  const userOpps = buildOpponents(mode, rng, stages.length);
  const fixtures: Fixture[] = stages.map((stage, i) => {
    const opponent = userOpps[i];
    // AI-vs-AI: pick two additional pool squads (best-effort, may be duplicates of user opps)
    const aiPair = buildOpponents(mode, rng, 2);
    return { stage, opponent, aiA: aiPair[0], aiB: aiPair[1] };
  });
  const ratingSnapshot = computeTeamRating(players).overall;
  const chem = chemistryBonus(players);

  return {
    mode, ourName, players, captain, seed,
    stages, fixtures,
    currentIndex: 0,
    results: [], aiResults: [],
    wins: 0, losses: 0, draws: 0,
    eliminated: false, championshipWon: false, complete: false,
    teamRatingSnapshot: ratingSnapshot,
    chemistryBonus: chem,
    finalStageReached: stages[0],
    finalScore: 0,
    playerStats: {},
    aiSeed: Math.floor(rng() * 1e9),
  };
}

function statKey(name: string) { return name; }

function ensureAgg(store: Record<string, PlayerAgg>, name: string, team: string, isOurs: boolean): PlayerAgg {
  const k = statKey(name);
  if (!store[k]) {
    store[k] = { name, team, matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, isOurs };
  }
  return store[k];
}

function ballsFromOvers(ov: number) {
  const whole = Math.floor(ov);
  const rem = Math.round((ov - whole) * 10);
  return whole * 6 + rem;
}

function accumulate(store: Record<string, PlayerAgg>, r: MatchResult, isOurs: boolean) {
  if (!r.full) return;
  const seen = new Set<string>();
  for (const inn of r.full) {
    const team = inn.teamName;
    const teamIsOurs = isOurs && team === r.ourName;
    for (const b of inn.batters) {
      const a = ensureAgg(store, b.name, team, teamIsOurs);
      a.runs += b.runs;
      a.balls += b.balls;
      a.fours += b.fours;
      a.sixes += b.sixes;
      seen.add(b.name);
    }
    for (const bw of inn.bowlers) {
      const a = ensureAgg(store, bw.name, team === r.ourName ? r.oppName : r.ourName, teamIsOurs);
      a.wickets += bw.wickets;
      a.ballsBowled += ballsFromOvers(bw.overs);
      a.runsConceded += bw.runs;
      seen.add(bw.name);
    }
  }
  for (const n of seen) store[n].matches += 1;
}

function computeFinalScore(state: TournamentState): number {
  const stageBonus: Record<string, number> = {
    "Group": 5, "League": 5, "Super 8": 10, "Quarter Final": 15,
    "Semi Final": 25, "Qualifier 1": 20, "Qualifier 2": 15, "Eliminator": 15,
    "Final": 40, "Test 1": 15, "Test 2": 15, "Test 3": 15,
  };
  return Math.round(
    state.teamRatingSnapshot * 3
    + state.wins * 12
    - state.losses * 4
    + (state.championshipWon ? 100 : 0)
    + (stageBonus[state.finalStageReached] ?? 0),
  );
}

/** Simulate exactly the next user match (plus one AI-vs-AI match for stats). Returns a new state. */
export function advanceTournament(prev: TournamentState): TournamentState {
  if (prev.complete) return prev;
  const state: TournamentState = {
    ...prev,
    results: [...prev.results],
    aiResults: [...prev.aiResults],
    playerStats: { ...prev.playerStats },
  };
  // Clone the agg entries too so downstream reference equality works
  for (const k of Object.keys(state.playerStats)) state.playerStats[k] = { ...state.playerStats[k] };

  let i = state.currentIndex;
  // Skip Franchise Qualifier 2 if we won Qualifier 1
  while (i < state.fixtures.length) {
    const fixture = state.fixtures[i];
    if (state.mode === "FRANCHISE_T20" && fixture.stage === "Qualifier 2") {
      const q1 = state.results[state.results.length - 1];
      if (q1 && "weWon" in q1 && q1.weWon) { i++; continue; }
    }
    break;
  }
  if (i >= state.fixtures.length) {
    state.complete = true;
    state.currentIndex = i;
    return finalize(state);
  }

  const fixture = state.fixtures[i];
  state.finalStageReached = fixture.stage;
  const matchRng = childRng(mulberry32(state.seed + i * 7919 + 13));

  // User match
  let r: MatchResult;
  if (state.mode === "TEST") {
    r = simulateTestMatch(state.ourName, state.players, fixture.opponent, fixture.stage, matchRng, state.captain);
    if ((r as TestScorecard).result === "WON") state.wins++;
    else if ((r as TestScorecard).result === "LOST") state.losses++;
    else state.draws++;
  } else {
    r = simulateLimitedMatch(state.ourName, state.players, fixture.opponent, state.mode, fixture.stage, matchRng, state.chemistryBonus);
    if ((r as LimitedScorecard).weWon) state.wins++; else state.losses++;
  }
  state.results.push(r);
  accumulate(state.playerStats, r, true);

  // AI-vs-AI stat sim (limited only to keep it snappy)
  if (state.mode !== "TEST" && fixture.aiA && fixture.aiB && fixture.aiA.name !== fixture.aiB.name) {
    const aiRng = childRng(mulberry32(state.aiSeed + i * 3527));
    const aiR = simulateLimitedMatch(fixture.aiA.name, fixture.aiA.players, fixture.aiB, state.mode, fixture.stage, aiRng, 0);
    state.aiResults.push(aiR);
    accumulate(state.playerStats, aiR, false);
  }

  // Elimination
  if (state.mode !== "TEST" && !(r as LimitedScorecard).weWon) {
    const isKO = (KNOCKOUT_STAGES as string[]).includes(fixture.stage);
    const isQ1 = state.mode === "FRANCHISE_T20" && fixture.stage === "Qualifier 1";
    if (isKO && !isQ1) {
      state.eliminated = true;
      state.eliminatedAt = fixture.stage;
    }
  }

  // League/group cutoff
  const groupStages: StageKind[] = ["League", "Group", "Super 8"];
  const nextStage = state.fixtures[i + 1]?.stage;
  if (
    !state.eliminated &&
    state.mode !== "TEST" &&
    groupStages.includes(fixture.stage) &&
    (!nextStage || !groupStages.includes(nextStage))
  ) {
    const groupResults = state.results.filter(x => "weWon" in x && groupStages.includes(x.stage));
    const groupWins = groupResults.filter(x => "weWon" in x && (x as LimitedScorecard).weWon).length;
    const needed = Math.ceil(groupResults.length / 2);
    if (groupWins < needed) {
      state.eliminated = true;
      state.eliminatedAt = fixture.stage;
    }
  }

  state.currentIndex = i + 1;
  if (state.eliminated || state.currentIndex >= state.fixtures.length) {
    state.complete = true;
  }
  return finalize(state);
}

function finalize(state: TournamentState): TournamentState {
  if (!state.complete) return state;
  const last = state.results[state.results.length - 1];
  let championshipWon = false;
  if (!state.eliminated && last) {
    if ("weWon" in last) championshipWon = last.weWon && last.stage === "Final";
    else championshipWon = state.wins > state.losses;
  }
  state.championshipWon = championshipWon;

  if (state.mode === "TEST" && state.fixtures[0]) {
    const oppName = state.fixtures[0].opponent.name.replace(" XI", "");
    state.seriesResult = `${state.ourName} ${state.wins} — ${state.losses} ${oppName} (${state.draws} draw${state.draws === 1 ? "" : "s"})`;
    const potPool = state.wins >= state.losses ? state.players : state.fixtures[0].opponent.players;
    state.playerOfSeries = [...potPool].sort(
      (a, b) => (b.stats.batting + b.stats.bowling) - (a.stats.batting + a.stats.bowling),
    )[0]?.name;
  }
  state.finalScore = computeFinalScore(state);
  return state;
}

/** Sorted leaderboards, top N of each. */
export function topRunScorers(state: TournamentState, n = 8): PlayerAgg[] {
  return Object.values(state.playerStats)
    .filter(p => p.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, n);
}
export function topWicketTakers(state: TournamentState, n = 8): PlayerAgg[] {
  return Object.values(state.playerStats)
    .filter(p => p.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, n);
}