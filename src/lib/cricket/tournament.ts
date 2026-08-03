import type {
  Player, GameMode, MatchResult, StageKind, LimitedScorecard, TestScorecard,
  PlayerAgg, FullInnings,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";
import { CHEMISTRY } from "./data";
import { DraftPoolService } from "@/services/DraftPoolService";
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
  const pool = DraftPoolService.getPool(mode);
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

export interface StandingRow {
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
  isOurs: boolean;
}

export function netRunRate(r: StandingRow): number {
  const forRate = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
  const againstRate = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
  return Math.round((forRate - againstRate) * 1000) / 1000;
}

/**
 * Circle-method round robin: every field team plays exactly once per matchday,
 * so the points table stays even across the tournament.
 */
function roundRobinRound(field: Opponent[], round: number): [Opponent, Opponent][] {
  const teams = [...field];
  if (teams.length % 2 === 1) teams.push(teams[0]); // odd field: one team repeats
  const n = teams.length;
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const shift = round % rotating.length;
  const order = [...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairs: [Opponent, Opponent][] = [[fixed, order[0]]];
  for (let k = 1; k < n / 2; k++) pairs.push([order[k], order[order.length - k]]);
  return pairs;
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
  /** Persistent AI field so the points table is the same teams all tournament. */
  field: Opponent[];
  standings: Record<string, StandingRow>;
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
  // One coherent competition field: the user's opponents are drawn from the same
  // set of teams that contest the background matchdays, so the table adds up.
  const field = mode === "TEST"
    ? buildOpponents(mode, rng, 1)
    : buildOpponents(mode, rng, Math.max(6, Math.min(8, stages.length + 2)));
  const fixtures: Fixture[] = stages.map((stage, i) => ({
    stage,
    opponent: field[i % field.length],
  }));
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
    field: mode === "TEST" ? [] : field,
    standings: {},
  };
}

function ensureRow(store: Record<string, StandingRow>, name: string, isOurs: boolean): StandingRow {
  if (!store[name]) {
    store[name] = {
      name, played: 0, wins: 0, losses: 0, points: 0,
      runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0, isOurs,
    };
  }
  if (isOurs) store[name].isOurs = true;
  return store[name];
}

/** Record one limited-overs result into the points table (2 pts a win, NRR tracked). */
function recordStanding(store: Record<string, StandingRow>, r: LimitedScorecard, ourIsUser: boolean) {
  const home = ensureRow(store, r.ourName, ourIsUser);
  const away = ensureRow(store, r.oppName, false);
  home.played++; away.played++;
  home.runsFor += r.ourInnings.runs; home.oversFor += r.ourInnings.overs;
  home.runsAgainst += r.oppInnings.runs; home.oversAgainst += r.oppInnings.overs;
  away.runsFor += r.oppInnings.runs; away.oversFor += r.oppInnings.overs;
  away.runsAgainst += r.ourInnings.runs; away.oversAgainst += r.ourInnings.overs;
  if (r.weWon) { home.wins++; home.points += 2; away.losses++; }
  else { away.wins++; away.points += 2; home.losses++; }
}

/** Standings sorted by points then NRR. */
export function standingsTable(state: TournamentState): StandingRow[] {
  return Object.values(state.standings).sort(
    (a, b) => b.points - a.points || netRunRate(b) - netRunRate(a) || b.wins - a.wins,
  );
}

/** Stats are per player PER TEAM — the same historical name can appear for
 *  our XI and for an AI squad in the same tournament. */
function statKey(name: string, team: string) { return `${team}::${name}`; }

function ensureAgg(store: Record<string, PlayerAgg>, name: string, team: string, isOurs: boolean): PlayerAgg {
  const k = statKey(name, team);
  if (!store[k]) {
    store[k] = { name, team, matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, isOurs };
  }
  // Ownership can be discovered later (a player may first appear as a bowler).
  if (isOurs) store[k].isOurs = true;
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
      seen.add(statKey(b.name, team));
    }
    for (const bw of inn.bowlers) {
      // Bowlers in an innings belong to the FIELDING side, i.e. the other team.
      const bowlingTeam = team === r.ourName ? r.oppName : r.ourName;
      const bowlerIsOurs = isOurs && bowlingTeam === r.ourName;
      const a = ensureAgg(store, bw.name, bowlingTeam, bowlerIsOurs);
      a.wickets += bw.wickets;
      a.ballsBowled += ballsFromOvers(bw.overs);
      a.runsConceded += bw.runs;
      seen.add(statKey(bw.name, bowlingTeam));
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
    fixtures: [...prev.fixtures],
    results: [...prev.results],
    aiResults: [...prev.aiResults],
    playerStats: { ...prev.playerStats },
    standings: { ...prev.standings },
  };
  // Clone the agg entries too so downstream reference equality works
  for (const k of Object.keys(state.playerStats)) state.playerStats[k] = { ...state.playerStats[k] };
  for (const k of Object.keys(state.standings)) state.standings[k] = { ...state.standings[k] };

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

  seedKnockoutFixture(state, i);
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
  if (state.mode !== "TEST") recordStanding(state.standings, r as LimitedScorecard, true);

  // Background round: every other team in the field plays this matchday too, so
  // the points table, NRR and stat leaders cover the whole tournament.
  if (state.mode !== "TEST" && state.field.length >= 2) {
    for (const [m, [a, b]] of roundRobinRound(state.field, i).entries()) {
      if (a.name === b.name) continue;
      // Skip the team that is busy playing us on this matchday.
      if (a.name === fixture.opponent.name || b.name === fixture.opponent.name) continue;
      const aiRng = childRng(mulberry32(state.aiSeed + i * 3527 + m * 101));
      const aiR = simulateLimitedMatch(a.name, a.players, b, state.mode, fixture.stage, aiRng, 0);
      state.aiResults.push(aiR);
      accumulate(state.playerStats, aiR, false);
      recordStanding(state.standings, aiR, false);
    }
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
  // Seed the upcoming knockout now so the "Next match" card shows the real opponent.
  if (!state.complete) seedKnockoutFixture(state, state.currentIndex);
  return finalize(state);
}

/** Replaces a knockout fixture's opponent with the correctly seeded team. */
function seedKnockoutFixture(state: TournamentState, index: number) {
  const fixture = state.fixtures[index];
  if (!fixture) return;
  const opponent = pickKnockoutOpponent(state, fixture);
  if (opponent && opponent.name !== fixture.opponent.name) {
    state.fixtures[index] = { ...fixture, opponent };
  }
}

function finalize(state: TournamentState): TournamentState {
  return finalizeInner(state);
}

/** Seeds a knockout fixture from the standings so playoffs follow real results. */
function pickKnockoutOpponent(state: TournamentState, fixture: Fixture): Opponent | null {
  if (state.mode === "TEST" || !state.field.length) return null;
  const ko: Record<string, number> = {
    "Qualifier 1": 0, "Semi Final": 0, "Final": 1, "Qualifier 2": 2, "Eliminator": 2, "Quarter Final": 3,
  };
  const seed = ko[fixture.stage];
  if (seed === undefined) return null;
  const ranked = standingsTable(state)
    .filter(r => !r.isOurs)
    .map(r => state.field.find(o => o.name === r.name))
    .filter((o): o is Opponent => Boolean(o));
  if (!ranked.length) return null;
  return ranked[Math.min(seed, ranked.length - 1)];
}

function finalizeInner(state: TournamentState): TournamentState {
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