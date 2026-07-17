import type { Player, GameMode, MatchResult, Pitch, Weather } from "./types";
import { CHEMISTRY, SQUADS_BY_MODE } from "./data";
import { pickCaptain } from "./rules";

// Deterministic-ish PRNG so results are reproducible per game
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PITCHES: Pitch[] = ["Green", "Flat", "Dusty", "Turning", "Slow"];
const WEATHERS: Weather[] = ["Sunny", "Cloudy", "Humid", "Night Match"];

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

function teamRating(players: Player[]) {
  if (!players.length) return 60;
  const bat = players.filter(p => p.role === "Batsman" || p.role === "Wicketkeeper" || p.role === "AllRounder");
  const bowl = players.filter(p => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder");
  const avg = (arr: Player[], key: keyof Player["stats"]) =>
    arr.reduce((s, p) => s + p.stats[key], 0) / Math.max(arr.length, 1);
  const batAvg = avg(bat, "batting");
  const bowlAvg = avg(bowl, "bowling");
  const pressure = avg(players, "pressure");
  const consistency = avg(players, "consistency");
  return (batAvg * 0.4 + bowlAvg * 0.4 + pressure * 0.1 + consistency * 0.1);
}

function pitchModifier(pitch: Pitch, players: Player[]) {
  const pace = players.filter(p => p.role === "PaceBowler").length;
  const spin = players.filter(p => p.role === "SpinBowler").length;
  switch (pitch) {
    case "Green":   return pace * 1.5;
    case "Flat":    return -2;
    case "Dusty":   return spin * 1.5;
    case "Turning": return spin * 2;
    case "Slow":    return spin * 1 - pace * 0.5;
  }
}

export interface Opponent {
  name: string;
  rating: number;
  players: Player[];
}

export function generateOpponents(mode: GameMode, rng: () => number): Opponent[] {
  const pool = SQUADS_BY_MODE[mode];
  const stages = 3;
  const opps: Opponent[] = [];
  for (let i = 0; i < stages; i++) {
    const squad = pool[Math.floor(rng() * pool.length)];
    // Take 11 strongest players from the squad as AI opponent
    const eleven = [...squad.players]
      .sort((a, b) => (b.stats.batting + b.stats.bowling) - (a.stats.batting + a.stats.bowling))
      .slice(0, 11);
    opps.push({
      name: `${squad.label} XI`,
      rating: teamRating(eleven),
      players: eleven,
    });
  }
  return opps;
}

function scoreLine(mode: GameMode, runs: number, wickets: number) {
  const overs = mode === "T20_WC" || mode === "FRANCHISE_T20" ? 20 :
                mode === "TEST" ? 90 : 50;
  return `${runs}/${wickets} (${overs}.0)`;
}

function cinematic(rng: () => number, players: Player[], mode: GameMode, opp: Opponent, won: boolean) {
  const highlights: string[] = [];
  const top = [...players].sort((a, b) => b.stats.batting + b.stats.form - a.stats.batting - a.stats.form)[0];
  const bowler = [...players].sort((a, b) => b.stats.bowling + b.stats.form - a.stats.bowling - a.stats.form)[0];
  const finisher = players.find(p => p.traits.includes("Finisher")) ?? top;

  const runs = Math.floor(40 + rng() * 80);
  const balls = Math.floor(runs * (0.7 + rng() * 0.6));
  highlights.push(`${top.name} scored ${runs} from ${balls}.`);

  const wkts = Math.floor(2 + rng() * 4);
  highlights.push(`${bowler.name} took ${wkts}/${20 + Math.floor(rng() * 30)}.`);

  if (won && finisher) highlights.push(`${finisher.name} finished the chase with a boundary.`);
  else if (!won) highlights.push(`${opp.name} defended the total under pressure.`);

  return {
    topScorer: { name: top.name, line: `${runs} (${balls})` },
    bestBowler: { name: bowler.name, line: `${wkts}/${20 + Math.floor(rng() * 30)}` },
    playerOfMatch: (won ? top : bowler).name,
    highlights,
    runs, wkts,
  };
}

export interface Tournament {
  results: MatchResult[];
  championshipWon: boolean;
  captain: Player;
  seed: number;
}

export function simulateTournament(players: Player[], mode: GameMode, seed = Date.now(), captainId?: string): Tournament {
  const rng = mulberry32(seed);
  const opponents = generateOpponents(mode, rng);
  const captain = (captainId && players.find(p => p.id === captainId)) || pickCaptain(players);
  const { total: chem } = chemistryBonus(players);
  const baseRating = teamRating(players) + chem + captain.stats.leadership * 0.03;

  const results: MatchResult[] = [];
  const stages: MatchResult["stage"][] = ["Quarter Final", "Semi Final", "Final"];

  let alive = true;
  for (let i = 0; i < 3; i++) {
    const opp = opponents[i];
    const pitch = PITCHES[Math.floor(rng() * PITCHES.length)];
    const weather = WEATHERS[Math.floor(rng() * WEATHERS.length)];
    const toss: "Won" | "Lost" = rng() > 0.5 ? "Won" : "Lost";
    const ourEff = baseRating + pitchModifier(pitch, players) + (toss === "Won" ? 1.5 : 0);
    const oppEff = opp.rating + pitchModifier(pitch, opp.players) - (toss === "Won" ? 1.5 : 0);
    const diff = ourEff - oppEff;
    const winProb = Math.min(0.92, Math.max(0.08, 0.5 + diff / 40));
    const roll = rng();
    const won = alive && roll < winProb;
    const cine = cinematic(rng, players, mode, opp, won);

    const ourRuns = 150 + Math.floor(rng() * 180) + (won ? 30 : 0);
    const oppRuns = 150 + Math.floor(rng() * 180) + (won ? 0 : 30);

    results.push({
      opponentName: opp.name,
      stage: stages[i],
      pitch, weather, toss,
      ourScore: scoreLine(mode, ourRuns, cine.wkts + 2),
      oppScore: scoreLine(mode, oppRuns, 10 - cine.wkts),
      winProbability: Math.round(winProb * 100),
      won,
      topScorer: cine.topScorer,
      bestBowler: cine.bestBowler,
      playerOfMatch: cine.playerOfMatch,
      highlights: cine.highlights,
    });

    if (!won) alive = false;
  }

  return { results, championshipWon: alive, captain, seed };
}

export function activatedChemistry(players: Player[]) {
  return chemistryBonus(players).activated;
}