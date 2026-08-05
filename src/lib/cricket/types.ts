export type Role =
  | "Batsman"
  | "Wicketkeeper"
  | "AllRounder"
  | "PaceBowler"
  | "SpinBowler";

export type GameMode =
  | "ODI_WC"
  | "T20_WC"
  | "CHAMPIONS"
  | "FRANCHISE_T20"
  | "TEST";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Legend";

export type Trait =
  | "Ice Veins"
  | "Death Overs Specialist"
  | "Powerplay Destroyer"
  | "Spin Wizard"
  | "Run Machine"
  | "Clutch Performer"
  | "Big Match Player"
  | "Finisher"
  | "Captain Fantastic"
  | "Wall"
  | "Strike Bowler";

export interface PlayerStats {
  batting: number;
  bowling: number;
  fielding: number;
  leadership: number;
  pressure: number;
  consistency: number;
  fitness: number;
  form: number;
}

export interface Player {
  id: string;
  /** Stable identity of the real human being, shared across every era/profile. */
  canonicalId?: string;
  name: string;
  country: string;
  role: Role;
  isCaptain?: boolean;
  isOverseas?: boolean; // for franchise mode
  traits: Trait[];
  stats: PlayerStats;
}

export interface Squad {
  id: string;
  label: string; // e.g. "India 2011"
  country: string;
  year: number;
  mode: GameMode;
  players: Player[];
  /** Present when the squad comes from the historical catalogue. */
  competitionId?: string;
  editionId?: string;
  teamId?: string;
}

export interface DraftRound {
  squad: Squad;
  choices: Player[]; // 5 randomly presented
}

export type Pitch = "Green" | "Flat" | "Dusty" | "Turning" | "Slow";
export type Weather = "Sunny" | "Cloudy" | "Humid" | "Night Match";

export type StageKind =
  | "League"
  | "Group"
  | "Super 8"
  | "Quarter Final"
  | "Semi Final"
  | "Qualifier 1"
  | "Qualifier 2"
  | "Eliminator"
  | "Final"
  | "Test 1"
  | "Test 2"
  | "Test 3";

export const KNOCKOUT_STAGES: StageKind[] = [
  "Quarter Final",
  "Semi Final",
  "Qualifier 1",
  "Qualifier 2",
  "Eliminator",
  "Final",
];

export interface Innings {
  teamName: string;
  runs: number;
  wickets: number;
  overs: number;          // e.g. 19.4
  runRate: number;
  topScorer: { name: string; runs: number; balls: number };
  bestBowler: { name: string; wickets: number; runs: number; overs: number };
  partnership: { names: [string, string]; runs: number };
  declared?: boolean;
  followOn?: boolean;
}

export type MatchFormat = "T20" | "ODI" | "TEST";

/* ---------- Full detailed innings (for scorecard modal + stats) ---------- */
export interface BatterLine {
  name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; how?: string;
}
export interface BowlerLine {
  name: string; overs: number; runs: number; wickets: number; maidens: number; econ: number;
}
export interface FallLine { runs: number; wicket: number; batter: string; over: number; }
export interface FullInnings {
  teamName: string;
  runs: number;
  wickets: number;
  overs: number;
  batters: BatterLine[];
  bowlers: BowlerLine[];
  fall: FallLine[];
  label?: string; // e.g. "1st Innings", "2nd Innings"
}

export interface LimitedScorecard {
  format: "T20" | "ODI";
  stage: StageKind;
  venue: string;
  pitch: Pitch;
  weather: Weather;
  toss: { winner: "us" | "opp"; decision: "bat" | "bowl" };
  ourName: string;
  oppName: string;
  ourInnings: Innings;
  oppInnings: Innings;
  weWon: boolean;
  marginText: string;      // e.g. "won by 6 runs"
  resultLine: string;      // e.g. "India won by 6 runs"
  playerOfMatch: string;
  highlights: string[];
  eliminated: boolean;     // true if this loss ends the run
  full?: FullInnings[];    // detailed batter/bowler lines (both teams, both innings)
  /** Present only when the main match finished level and a Super Over decided it. */
  superOver?: SuperOver;
}

export interface SuperOverSide {
  teamName: string;
  runs: number;
  wickets: number;
}
export interface SuperOver {
  ours: SuperOverSide;
  opp: SuperOverSide;
  winner: string;
  weWon: boolean;
}

export interface TestScorecard {
  format: "TEST";
  stage: StageKind;
  venue: string;
  pitch: Pitch;
  weather: Weather;
  toss: { winner: "us" | "opp"; decision: "bat" | "bowl" };
  ourName: string;
  oppName: string;
  ourInnings: Innings[];   // 1 or 2
  oppInnings: Innings[];   // 1 or 2
  result: "WON" | "LOST" | "DRAW";
  marginText: string;
  resultLine: string;
  playerOfMatch: string;
  highlights: string[];
  sessionsNote: string;
  eliminated: boolean;     // series-level early termination unused for tests
  full?: FullInnings[];
}

export type MatchResult = LimitedScorecard | TestScorecard;

/* ---------- Tournament-wide aggregated stats ---------- */
export interface PlayerAgg {
  name: string;
  team: string;
  matches: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  isOurs: boolean;
}