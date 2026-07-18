import type {
  Player, GameMode, MatchResult, Pitch, Weather,
  Innings, LimitedScorecard, TestScorecard, StageKind,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";
import { CHEMISTRY, SQUADS_BY_MODE } from "./data";
import { pickCaptain } from "./rules";
import { computeTeamRating, overall } from "./rating";

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
const VENUES = [
  "Wankhede, Mumbai", "Eden Gardens, Kolkata", "MCG, Melbourne",
  "Lord's, London", "SCG, Sydney", "Newlands, Cape Town",
  "Chinnaswamy, Bangalore", "Gaddafi, Lahore", "R. Premadasa, Colombo",
  "Kensington Oval, Bridgetown", "Basin Reserve, Wellington",
  "Trent Bridge, Nottingham", "Adelaide Oval",
];

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

export function generateOpponents(mode: GameMode, rng: () => number, count = 3): Opponent[] {
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
    // Take 11 strongest players from the squad as AI opponent
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

/* ---------- Format-aware scoring ---------- */

// Historic era multiplier — 1975 ODIs scored less than 2023 ODIs.
function eraMultiplier(year: number, mode: GameMode) {
  if (mode === "T20_WC" || mode === "FRANCHISE_T20") {
    // T20 scoring grew ~2007→now
    if (year < 2010) return 0.90;
    if (year < 2016) return 0.97;
    return 1.03;
  }
  if (mode === "ODI_WC" || mode === "CHAMPIONS") {
    if (year < 1985) return 0.72;
    if (year < 2000) return 0.85;
    if (year < 2011) return 0.95;
    return 1.05;
  }
  // Tests
  if (year < 1990) return 0.90;
  return 1.0;
}

function overs(format: "T20" | "ODI") {
  return format === "T20" ? 20 : 50;
}

function baseTotal(format: "T20" | "ODI") {
  return format === "T20" ? 155 : 265;
}

function totalRange(format: "T20" | "ODI"): [number, number] {
  return format === "T20" ? [95, 245] : [175, 385];
}

function pickTop<T>(arr: T[], key: (t: T) => number, rng: () => number, jitter = 5): T {
  const sorted = [...arr].sort((a, b) => key(b) + rng() * jitter - key(a) - rng() * jitter);
  return sorted[0];
}

function makeInnings(
  teamName: string,
  players: Player[],
  bowlingSide: Player[],
  targetRuns: number,       // desired final score
  format: "T20" | "ODI",
  rng: () => number,
  chasing: boolean,
  target?: number,          // if chasing, needed runs to win
): Innings {
  const maxOvers = overs(format);
  const [lo, hi] = totalRange(format);
  let runs = Math.max(lo - 20, Math.min(hi + 10, Math.round(targetRuns)));

  // Wickets: correlate loosely with pressure; more wickets when defending short totals or collapsing
  let wickets = Math.min(10, Math.max(1, Math.round(3 + rng() * 6)));

  // Overs
  let oversPlayed: number;
  if (chasing && target !== undefined && runs >= target) {
    // Successful chase — end when target crossed. Random over count.
    const oversInt = Math.floor(maxOvers * (0.7 + rng() * 0.3));
    const balls = Math.floor(rng() * 6);
    oversPlayed = Math.min(maxOvers, oversInt + balls / 10);
    wickets = Math.min(9, wickets);
  } else if (chasing && target !== undefined && runs < target) {
    // Fell short — either all out or overs done
    if (rng() < 0.55) {
      wickets = 10;
      const oversInt = Math.floor(maxOvers * (0.6 + rng() * 0.35));
      oversPlayed = Math.min(maxOvers - 0.1, oversInt + Math.floor(rng() * 6) / 10);
    } else {
      oversPlayed = maxOvers;
    }
  } else {
    // Batting first: usually full overs unless all out
    if (rng() < 0.20) {
      wickets = 10;
      const oversInt = Math.floor(maxOvers * (0.65 + rng() * 0.3));
      oversPlayed = Math.min(maxOvers - 0.1, oversInt + Math.floor(rng() * 6) / 10);
    } else {
      oversPlayed = maxOvers;
    }
  }

  const batters = players.filter(p => p.role !== "PaceBowler" && p.role !== "SpinBowler");
  const bowlers = bowlingSide.filter(p => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder");

  const topBatter = pickTop(batters, p => p.stats.batting + p.stats.form * 0.3, rng);
  const topBatterRuns = Math.max(20, Math.min(runs - 15, Math.round(runs * (0.30 + rng() * 0.25))));
  const strikeRate = format === "T20" ? 1.25 + rng() * 0.45 : 0.85 + rng() * 0.35;
  const topBatterBalls = Math.max(15, Math.round(topBatterRuns / strikeRate));

  const bestBowler = pickTop(bowlers.length ? bowlers : players, p => p.stats.bowling + p.stats.form * 0.3, rng);
  const bowlerWkts = Math.max(1, Math.min(6, Math.round(1 + rng() * (wickets - 1))));
  const bowlerOvers = format === "T20" ? 4 : Math.min(10, 6 + Math.floor(rng() * 5));
  const bowlerRuns = Math.max(8, Math.round(bowlerOvers * (5 + rng() * 4)));

  const partnerCandidates = batters.filter(b => b.id !== topBatter.id);
  const partner = partnerCandidates.length ? pickTop(partnerCandidates, p => p.stats.batting, rng) : topBatter;
  const partnershipRuns = Math.max(topBatterRuns, Math.round(runs * (0.35 + rng() * 0.2)));

  const runRate = oversPlayed > 0
    ? Math.round((runs / (Math.floor(oversPlayed) + (oversPlayed % 1) * (10 / 6))) * 100) / 100
    : 0;

  return {
    teamName,
    runs,
    wickets,
    overs: Math.round(oversPlayed * 10) / 10,
    runRate,
    topScorer: { name: topBatter.name, runs: topBatterRuns, balls: topBatterBalls },
    bestBowler: {
      name: bestBowler.name,
      wickets: bowlerWkts,
      runs: bowlerRuns,
      overs: bowlerOvers,
    },
    partnership: {
      names: [topBatter.name, partner.name],
      runs: partnershipRuns,
    },
  };
}

function marginLimited(win: boolean, first: Innings, second: Innings, weBattedFirst: boolean) {
  const our = weBattedFirst ? first : second;
  const opp = weBattedFirst ? second : first;
  const runs = weBattedFirst ? our.runs - opp.runs : opp.runs - our.runs; // margin
  if (win) {
    if (!weBattedFirst) {
      const wktsLeft = 10 - our.wickets;
      return `won by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
    }
    return `won by ${runs} run${runs === 1 ? "" : "s"}`;
  } else {
    if (weBattedFirst) {
      const wktsLeft = 10 - opp.wickets;
      return `lost by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
    }
    return `lost by ${-runs} run${-runs === 1 ? "" : "s"}`;
  }
}

function simulateLimitedMatch(
  ourName: string,
  ourPlayers: Player[],
  opp: Opponent,
  mode: GameMode,
  stage: StageKind,
  rng: () => number,
  captain: Player,
): LimitedScorecard {
  const format: "T20" | "ODI" =
    mode === "T20_WC" || mode === "FRANCHISE_T20" ? "T20" : "ODI";

  const pitch = PITCHES[Math.floor(rng() * PITCHES.length)];
  const weather = WEATHERS[Math.floor(rng() * WEATHERS.length)];
  const venue = VENUES[Math.floor(rng() * VENUES.length)];
  const tossWinner: "us" | "opp" = rng() < 0.5 ? "us" : "opp";
  const tossDecision: "bat" | "bowl" = rng() < 0.5 ? "bat" : "bowl";

  // Era based on rough mode year context — use avg of players for era mult
  const yearHint = mode === "T20_WC" ? 2018 :
                   mode === "FRANCHISE_T20" ? 2020 :
                   mode === "ODI_WC" ? 2015 :
                   mode === "CHAMPIONS" ? 2017 : 2010;
  const eraMult = eraMultiplier(yearHint, mode);

  const { total: chem } = chemistryBonus(ourPlayers);
  const ourRating = teamStrength(ourPlayers) + chem + captain.stats.leadership * 0.02
                    + pitchModifier(pitch, ourPlayers);
  const oppRating = opp.rating + pitchModifier(pitch, opp.players);

  const diff = ourRating - oppRating;
  const base = baseTotal(format);

  // Randomized totals scaled by ratings + era
  const noise = () => (rng() - 0.5) * (format === "T20" ? 55 : 90);
  const ourTargetRuns = (base + diff * 1.2 + noise()) * eraMult;
  const oppTargetRuns = (base - diff * 1.2 + noise()) * eraMult;

  // We bat first if we won toss and chose bat, or opp won toss and chose bowl
  const weBattedFirst =
    (tossWinner === "us" && tossDecision === "bat") ||
    (tossWinner === "opp" && tossDecision === "bowl");

  let ourInnings: Innings;
  let oppInnings: Innings;

  if (weBattedFirst) {
    ourInnings = makeInnings(ourName, ourPlayers, opp.players, ourTargetRuns, format, rng, false);
    const target = ourInnings.runs + 1;
    // Opp chases: probability of success based on diff
    const chaseSuccessProb = Math.min(0.9, Math.max(0.1, 0.5 - diff / 30));
    const oppChaseRuns = rng() < chaseSuccessProb ? target + Math.floor(rng() * 15) : target - 1 - Math.floor(rng() * 40);
    oppInnings = makeInnings(opp.name, opp.players, ourPlayers, oppChaseRuns, format, rng, true, target);
  } else {
    oppInnings = makeInnings(opp.name, opp.players, ourPlayers, oppTargetRuns, format, rng, false);
    const target = oppInnings.runs + 1;
    const chaseSuccessProb = Math.min(0.9, Math.max(0.1, 0.5 + diff / 30));
    const ourChaseRuns = rng() < chaseSuccessProb ? target + Math.floor(rng() * 15) : target - 1 - Math.floor(rng() * 40);
    ourInnings = makeInnings(ourName, ourPlayers, opp.players, ourChaseRuns, format, rng, true, target);
  }

  // Winner from actual scores — authoritative
  const weWon = ourInnings.runs > oppInnings.runs;
  const marginText = marginLimited(weWon,
    weBattedFirst ? ourInnings : oppInnings,
    weBattedFirst ? oppInnings : ourInnings,
    weBattedFirst,
  );
  const resultLine = `${weWon ? ourName : opp.name} ${marginText.replace(/^won|lost/, "won")}`;

  const highlights: string[] = [];
  highlights.push(`Toss: ${tossWinner === "us" ? ourName : opp.name} won and chose to ${tossDecision}.`);
  highlights.push(`${ourInnings.topScorer.name} anchored with ${ourInnings.topScorer.runs} off ${ourInnings.topScorer.balls}.`);
  highlights.push(`${(weWon ? ourInnings : oppInnings).bestBowler.name} broke through with a key spell.`);
  if (weWon) highlights.push(`${ourName} sealed it under pressure.`);
  else highlights.push(`${opp.name} held their nerve at the death.`);

  const potPool = weWon ? ourPlayers : opp.players;
  const potWinner = pickTop(potPool, p => p.stats.batting + p.stats.bowling + p.stats.pressure * 0.5, rng);

  const isKnockout = (KNOCKOUT_STAGES as string[]).includes(stage);
  return {
    format,
    stage,
    venue,
    pitch,
    weather,
    toss: { winner: tossWinner, decision: tossDecision },
    ourName,
    oppName: opp.name,
    ourInnings,
    oppInnings,
    weWon,
    marginText,
    resultLine,
    playerOfMatch: potWinner.name,
    highlights,
    eliminated: !weWon && isKnockout,
  };
}

/* ---------- Test Match Engine ---------- */

function testInnings(
  teamName: string,
  players: Player[],
  bowlingSide: Player[],
  targetRuns: number,
  rng: () => number,
  declared = false,
  followOn = false,
): Innings {
  const runs = Math.max(80, Math.round(targetRuns));
  const wickets = declared ? Math.min(9, 4 + Math.floor(rng() * 5)) : (rng() < 0.7 ? 10 : 5 + Math.floor(rng() * 5));
  const oversPlayed = Math.max(40, Math.min(160, Math.round((runs / (2.8 + rng() * 0.9)) * 10) / 10));

  const batters = players.filter(p => p.role !== "PaceBowler" && p.role !== "SpinBowler");
  const bowlers = bowlingSide.filter(p => p.role === "PaceBowler" || p.role === "SpinBowler" || p.role === "AllRounder");
  const topBatter = pickTop(batters, p => p.stats.batting + p.stats.consistency * 0.4, rng);
  const topBatterRuns = Math.max(40, Math.min(runs - 20, Math.round(runs * (0.28 + rng() * 0.25))));
  const topBatterBalls = Math.round(topBatterRuns / (0.55 + rng() * 0.25));
  const bestBowler = pickTop(bowlers.length ? bowlers : players, p => p.stats.bowling, rng);
  const bowlerWkts = Math.min(wickets, Math.max(2, 3 + Math.floor(rng() * 5)));
  const bowlerOvers = 15 + Math.floor(rng() * 15);
  const bowlerRuns = Math.max(20, Math.round(bowlerOvers * (2 + rng() * 2)));
  const partnerCandidates = batters.filter(b => b.id !== topBatter.id);
  const partner = partnerCandidates.length ? pickTop(partnerCandidates, p => p.stats.batting, rng) : topBatter;

  const runRate = oversPlayed > 0 ? Math.round((runs / oversPlayed) * 100) / 100 : 0;

  return {
    teamName,
    runs,
    wickets,
    overs: oversPlayed,
    runRate,
    topScorer: { name: topBatter.name, runs: topBatterRuns, balls: topBatterBalls },
    bestBowler: { name: bestBowler.name, wickets: bowlerWkts, runs: bowlerRuns, overs: bowlerOvers },
    partnership: { names: [topBatter.name, partner.name], runs: Math.round(runs * (0.35 + rng() * 0.2)) },
    declared,
    followOn,
  };
}

function simulateTestMatch(
  ourName: string,
  ourPlayers: Player[],
  opp: Opponent,
  stage: StageKind,
  rng: () => number,
  captain: Player,
): TestScorecard {
  const pitch = PITCHES[Math.floor(rng() * PITCHES.length)];
  const weather = WEATHERS[Math.floor(rng() * WEATHERS.length)];
  const venue = VENUES[Math.floor(rng() * VENUES.length)];
  const tossWinner: "us" | "opp" = rng() < 0.5 ? "us" : "opp";
  const tossDecision: "bat" | "bowl" = rng() < 0.6 ? "bat" : "bowl";
  const weBattedFirst =
    (tossWinner === "us" && tossDecision === "bat") ||
    (tossWinner === "opp" && tossDecision === "bowl");

  const { total: chem } = chemistryBonus(ourPlayers);
  const ourRating = teamStrength(ourPlayers) + chem + captain.stats.leadership * 0.02 + pitchModifier(pitch, ourPlayers);
  const oppRating = opp.rating + pitchModifier(pitch, opp.players);
  const diff = ourRating - oppRating;

  const base = 320;
  const noise = () => (rng() - 0.5) * 140;

  // First innings
  const our1 = testInnings(ourName, ourPlayers, opp.players, base + diff * 1.5 + noise(), rng);
  const opp1 = testInnings(opp.name, opp.players, ourPlayers, base - diff * 1.5 + noise(), rng);

  // Second innings — check follow-on possibility and drawn match chance
  const drawRoll = rng();
  const isDraw = drawRoll < 0.18;

  const ourInnings: Innings[] = [our1];
  const oppInnings: Innings[] = [opp1];

  if (!isDraw) {
    if (weBattedFirst) {
      const lead = our1.runs - opp1.runs;
      const followOn = lead >= 200 && rng() < 0.5;
      if (followOn) {
        const opp2 = testInnings(opp.name, opp.players, ourPlayers, base - diff + noise(), rng, false, true);
        oppInnings.push(opp2);
        const target = our1.runs - opp1.runs - opp2.runs;
        if (target > 0) {
          const our2 = testInnings(ourName, ourPlayers, opp.players, Math.min(target + 30, base + diff), rng);
          // Trim to <= target if lost, else win
          if (rng() < 0.5) { our2.runs = target - 20 - Math.floor(rng() * 40); our2.wickets = 10; }
          else { our2.runs = target + 5; our2.wickets = Math.min(6, our2.wickets); }
          ourInnings.push(our2);
        }
      } else {
        const opp2 = testInnings(opp.name, opp.players, ourPlayers, base - diff + noise(), rng);
        oppInnings.push(opp2);
        const target = (our1.runs + (opp1.runs < our1.runs ? 0 : 0)) - opp1.runs + opp2.runs;
        // Simpler: build fourth innings from us chasing (opp1 - our1 + opp2)
        const chaseTarget = Math.max(100, opp2.runs + (opp1.runs - our1.runs) + 1);
        const our2 = testInnings(ourName, ourPlayers, opp.players, chaseTarget + (diff > 0 ? 20 : -30), rng);
        if (rng() < (0.5 + diff / 40)) { our2.runs = chaseTarget + Math.floor(rng() * 40); our2.wickets = Math.min(6, our2.wickets); }
        else { our2.runs = chaseTarget - 20 - Math.floor(rng() * 60); our2.wickets = 10; }
        ourInnings.push(our2);
      }
    } else {
      // Opp batted first
      const our2Target = base + diff + noise();
      const our2First = testInnings(ourName, ourPlayers, opp.players, our2Target, rng);
      ourInnings.push(our2First);
      // opp 2nd = fourth innings
      const chaseTarget = Math.max(100, (our1.runs + our2First.runs) - opp1.runs + 1);
      const opp2 = testInnings(opp.name, opp.players, ourPlayers, chaseTarget + (diff > 0 ? -30 : 20), rng);
      if (rng() < (0.5 - diff / 40)) { opp2.runs = chaseTarget + Math.floor(rng() * 40); opp2.wickets = Math.min(6, opp2.wickets); }
      else { opp2.runs = chaseTarget - 20 - Math.floor(rng() * 60); opp2.wickets = 10; }
      oppInnings.push(opp2);
    }
  }

  const ourTotal = ourInnings.reduce((s, i) => s + i.runs, 0);
  const oppTotal = oppInnings.reduce((s, i) => s + i.runs, 0);
  let result: "WON" | "LOST" | "DRAW";
  let marginText: string;
  if (isDraw) {
    result = "DRAW";
    marginText = "Match drawn — rain and stubborn defence";
  } else if (ourTotal > oppTotal && oppInnings.length === 2 && oppInnings[1].wickets === 10) {
    result = "WON";
    marginText = `won by ${ourTotal - oppTotal} runs`;
  } else if (ourTotal < oppTotal && ourInnings.length === 2 && ourInnings[1].wickets === 10) {
    result = "LOST";
    marginText = `lost by ${oppTotal - ourTotal} runs`;
  } else if (ourInnings.length === 2 && ourInnings[1].wickets < 10 && ourTotal > oppTotal) {
    const wktsLeft = 10 - ourInnings[1].wickets;
    result = "WON";
    marginText = `won by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
  } else if (oppInnings.length === 2 && oppInnings[1].wickets < 10 && oppTotal > ourTotal) {
    const wktsLeft = 10 - oppInnings[1].wickets;
    result = "LOST";
    marginText = `lost by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
  } else if (ourTotal === oppTotal) {
    result = "DRAW";
    marginText = "Tied";
  } else {
    // Fallback by totals
    result = ourTotal > oppTotal ? "WON" : "LOST";
    marginText = `${result === "WON" ? "won" : "lost"} by ${Math.abs(ourTotal - oppTotal)} runs`;
  }

  const resultLine = result === "DRAW"
    ? "Match drawn"
    : `${result === "WON" ? ourName : opp.name} ${marginText.replace(/^won|lost/, "won")}`;

  const potPool = result === "WON" ? ourPlayers : result === "LOST" ? opp.players : ourPlayers;
  const potWinner = pickTop(potPool, p => p.stats.batting + p.stats.bowling, rng);

  const sessionsNote = [
    `Day 1 morning: ${weBattedFirst ? ourName : opp.name} openers set the tone.`,
    `Day 2 afternoon: partnership of ${our1.partnership.runs} steadied the innings.`,
    `Day 3 evening: new ball brought a mini collapse.`,
    `Day 5 final session: ${result === "DRAW" ? "tail hung on for the draw." : "chased the result home."}`,
  ].join(" ");

  return {
    format: "TEST",
    stage,
    venue,
    pitch,
    weather,
    toss: { winner: tossWinner, decision: tossDecision },
    ourName,
    oppName: opp.name,
    ourInnings,
    oppInnings,
    result,
    marginText,
    resultLine,
    playerOfMatch: potWinner.name,
    highlights: [
      `${our1.topScorer.name} ground out ${our1.topScorer.runs} in the first innings.`,
      `${opp1.bestBowler.name} led the attack with ${opp1.bestBowler.wickets}/${opp1.bestBowler.runs}.`,
      result === "DRAW" ? "Weather and a flat wicket forced the draw." : `Fourth innings tension decided the Test.`,
    ],
    sessionsNote,
    eliminated: false,
  };
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

  const results: MatchResult[] = [];
  let wins = 0, losses = 0, draws = 0;
  let eliminated = false;
  let eliminatedAt: StageKind | undefined;
  let finalStageReached: StageKind = stages[0];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    finalStageReached = stage;
    const opp = opponents[i % opponents.length];

    if (mode === "TEST") {
      const t = simulateTestMatch(ourName, players, opp, stage, rng, captain);
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

    const m = simulateLimitedMatch(ourName, players, opp, mode, stage, rng, captain);
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