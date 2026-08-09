import type { GameMode, MatchFormat, Role, Trait } from "@/lib/cricket/types";

/** Competitions are historical, not the same thing as a playable GameMode. */
export type CompetitionId = "ODI_WC" | "T20_WC" | "CHAMPIONS" | "IPL" | "ODI" | "TEST";

export type SourceStatus = "verified" | "partiallyVerified" | "generatedPlaceholder";

export type BowlingRole = "specialist" | "allRounder" | "partTime" | "none";

export type DetailedRole =
  | "Opener"
  | "Top Order"
  | "Middle Order"
  | "Finisher"
  | "Wicketkeeper-Batter"
  | "Batting All-rounder"
  | "Bowling All-rounder"
  | "Fast Bowler"
  | "Fast-medium Bowler"
  | "Swing Bowler"
  | "Seam Bowler"
  | "Off-spinner"
  | "Leg-spinner"
  | "Left-arm Orthodox"
  | "Left-arm Wrist Spinner";

export interface Competition {
  id: CompetitionId;
  name: string;
  format: MatchFormat;
  /** Playable game mode this competition feeds, when one exists. */
  mode: GameMode | null;
}

export interface Edition {
  id: string; // e.g. "odiwc-2011"
  competitionId: CompetitionId;
  year: number;
  label: string; // e.g. "World Cup 2011"
}

export interface Team {
  id: string; // canonical, stable across renames
  name: string; // current/default display name
  type: "International" | "Franchise";
  country: string;
  /** Franchise renames share a lineage id so "same team, different year" spans them. */
  franchiseLineageId?: string;
  /** Historical display names keyed by the first year they applied. */
  nameHistory?: { from: number; name: string }[];
}

/** One real human being. Never duplicated per era. */
export interface CanonicalPlayer {
  id: string; // slug of the name, e.g. "virat-kohli"
  name: string;
  nationality: string;
}

/** The version of a player as they were in one specific squad. */
export interface PlayerEditionProfile {
  id: string; // `${squadId}::${playerId}`
  playerId: string;
  name: string;
  nationality: string;

  competitionId: CompetitionId;
  editionId: string;
  teamId: string;
  squadId: string;

  role: Role; // engine-level role
  primaryRole: DetailedRole;
  secondaryRoles: DetailedRole[];

  batting: number;
  bowling: number;
  fielding: number;
  wicketkeeping?: number;
  leadership: number;
  pressure: number;
  consistency: number;
  fitness: number;
  form: number;

  overall: number;

  canKeepWicket: boolean;
  bowlingRole: BowlingRole;
  isOverseas: boolean;
  historicalCaptain: boolean;
  traits: Trait[];
}

export interface HistoricalSquad {
  id: string; // `${competitionId}:${editionId}:${teamId}`
  competitionId: CompetitionId;
  editionId: string;
  teamId: string;
  year: number;
  label: string; // e.g. "India — World Cup 2011"
  teamName: string; // era-correct team name
  sourceStatus: SourceStatus;
  playerProfileIds: string[];
}
