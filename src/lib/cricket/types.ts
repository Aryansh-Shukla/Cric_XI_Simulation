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
}

export interface DraftRound {
  squad: Squad;
  choices: Player[]; // 5 randomly presented
}

export type Pitch = "Green" | "Flat" | "Dusty" | "Turning" | "Slow";
export type Weather = "Sunny" | "Cloudy" | "Humid" | "Night Match";

export interface MatchResult {
  opponentName: string;
  stage: "Quarter Final" | "Semi Final" | "Final";
  pitch: Pitch;
  weather: Weather;
  toss: "Won" | "Lost";
  ourScore: string;
  oppScore: string;
  winProbability: number;
  won: boolean;
  topScorer: { name: string; line: string };
  bestBowler: { name: string; line: string };
  playerOfMatch: string;
  highlights: string[];
}