import type { Role, Trait } from "@/lib/cricket/types";
import type {
  BowlingRole, CanonicalPlayer, CompetitionId, DetailedRole,
  HistoricalSquad, PlayerEditionProfile, SourceStatus,
} from "./model";
import { EDITION_BY_ID } from "./competitions";
import { TEAM_BY_ID, teamNameForYear } from "./teams";

/* ------------------------------------------------------------------ *
 * Compact authoring format.
 *
 *   "MS Dhoni|WK|88|0|86|C"
 *    name    role bat bwl fld flags
 *
 * Flags (any order, pipe separated):
 *   C            historical captain of this squad
 *   K            can keep wicket (implicit for WK)
 *   @Country     nationality override (required for franchise overseas players)
 *   >Detail      detailed primary role override, e.g. ">Leg-spinner"
 *
 * Overall is always derived from the agreed role formulas, never authored.
 * ------------------------------------------------------------------ */

const ROLE_CODES: Record<string, Role> = {
  BAT: "Batsman",
  WK: "Wicketkeeper",
  AR: "AllRounder",
  PACE: "PaceBowler",
  SPIN: "SpinBowler",
};

export const canonicalPlayerId = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n)));

/** The agreed role-specific Overall formulas. Single source of truth. */
export function computeOverall(role: Role, batting: number, bowling: number, fielding: number, wk?: number): number {
  switch (role) {
    case "Batsman": return Math.round(batting);
    case "PaceBowler":
    case "SpinBowler": return Math.round(bowling);
    case "AllRounder": return Math.round((batting + bowling) / 2);
    case "Wicketkeeper": return Math.round((batting + (wk ?? fielding)) / 2);
  }
}

function defaultDetailedRole(role: Role, batting: number, bowling: number): DetailedRole {
  switch (role) {
    case "Batsman": return batting >= 88 ? "Top Order" : "Middle Order";
    case "Wicketkeeper": return "Wicketkeeper-Batter";
    case "AllRounder": return batting >= bowling ? "Batting All-rounder" : "Bowling All-rounder";
    case "PaceBowler": return bowling >= 88 ? "Fast Bowler" : "Fast-medium Bowler";
    case "SpinBowler": return "Off-spinner";
  }
}

function deriveBowlingRole(role: Role, bowling: number): BowlingRole {
  if (role === "PaceBowler" || role === "SpinBowler") return "specialist";
  if (role === "AllRounder") return "allRounder";
  if (bowling >= 55) return "partTime";
  return "none";
}

function deriveTraits(role: Role, bat: number, bowl: number, isCaptain: boolean, year: number): Trait[] {
  const t: Trait[] = [];
  if (isCaptain) t.push("Captain Fantastic");
  if (role === "Batsman" && bat >= 92) t.push("Run Machine");
  if (role === "Batsman" && bat >= 88 && year >= 2005) t.push("Powerplay Destroyer");
  if (role === "Batsman" && bat >= 86 && year < 2000) t.push("Wall");
  if (role === "Wicketkeeper" && bat >= 84) t.push("Finisher");
  if (role === "AllRounder" && bat >= 82) t.push("Finisher");
  if (role === "AllRounder" && bowl >= 84) t.push("Strike Bowler");
  if (role === "PaceBowler" && bowl >= 90) t.push("Strike Bowler");
  if (role === "PaceBowler" && bowl >= 86 && year >= 2005) t.push("Death Overs Specialist");
  if (role === "SpinBowler" && bowl >= 82) t.push("Spin Wizard");
  if (bat >= 95 || bowl >= 95) t.push("Big Match Player");
  return Array.from(new Set(t));
}

/* ---------------- registry ---------------- */

export const PLAYER_REGISTRY = new Map<string, CanonicalPlayer>();
export const PROFILE_REGISTRY = new Map<string, PlayerEditionProfile>();
export const SQUAD_REGISTRY: HistoricalSquad[] = [];

export interface SquadInput {
  competitionId: CompetitionId;
  editionId: string;
  teamId: string;
  sourceStatus?: SourceStatus;
  rows: string[];
}

export function defineSquad(input: SquadInput): HistoricalSquad {
  const edition = EDITION_BY_ID.get(input.editionId);
  const team = TEAM_BY_ID.get(input.teamId);
  if (!edition) throw new Error(`[data] unknown edition ${input.editionId}`);
  if (!team) throw new Error(`[data] unknown team ${input.teamId}`);

  const year = edition.year;
  const teamName = teamNameForYear(team.id, year);
  const squadId = `${input.competitionId}:${input.editionId}:${input.teamId}`;
  const profileIds: string[] = [];

  for (const row of input.rows) {
    const parts = row.split("|").map(s => s.trim());
    const [name, roleCode, batS, bowlS, fldS, ...flags] = parts;
    const role = ROLE_CODES[roleCode];
    if (!role) throw new Error(`[data] bad role "${roleCode}" in ${squadId} (${name})`);

    const batting = clamp(Number(batS));
    const bowling = clamp(Number(bowlS) || 1);
    const fielding = clamp(Number(fldS));

    const isCaptain = flags.includes("C");
    const nationalityFlag = flags.find(f => f.startsWith("@"));
    const detailFlag = flags.find(f => f.startsWith(">"));
    const nationality = nationalityFlag ? nationalityFlag.slice(1) : team.country;
    const canKeepWicket = role === "Wicketkeeper" || flags.includes("K");
    const wicketkeeping = canKeepWicket ? clamp(fielding + 2) : undefined;

    const playerId = canonicalPlayerId(name);
    if (!PLAYER_REGISTRY.has(playerId)) {
      PLAYER_REGISTRY.set(playerId, { id: playerId, name, nationality });
    }

    const overall = computeOverall(role, batting, bowling, fielding, wicketkeeping);
    const profileId = `${squadId}::${playerId}`;
    if (PROFILE_REGISTRY.has(profileId)) {
      throw new Error(`[data] duplicate player ${name} in squad ${squadId}`);
    }

    const profile: PlayerEditionProfile = {
      id: profileId,
      playerId,
      name,
      nationality,
      competitionId: input.competitionId,
      editionId: input.editionId,
      teamId: input.teamId,
      squadId,
      role,
      primaryRole: (detailFlag?.slice(1) as DetailedRole) ?? defaultDetailedRole(role, batting, bowling),
      secondaryRoles: [],
      batting,
      bowling,
      fielding,
      wicketkeeping,
      leadership: isCaptain ? clamp(82 + overall / 8) : clamp(42 + overall / 4),
      pressure: clamp(58 + (overall - 70) * 0.6 + (isCaptain ? 6 : 0)),
      consistency: clamp(60 + (overall - 70) * 0.65),
      fitness: clamp(year >= 2005 ? 82 : 74),
      form: clamp(66 + (overall - 70) * 0.4),
      overall,
      canKeepWicket,
      bowlingRole: deriveBowlingRole(role, bowling),
      isOverseas: team.type === "Franchise" && nationality !== "India",
      historicalCaptain: isCaptain,
      traits: deriveTraits(role, batting, bowling, isCaptain, year),
    };
    PROFILE_REGISTRY.set(profileId, profile);
    profileIds.push(profileId);
  }

  const squad: HistoricalSquad = {
    id: squadId,
    competitionId: input.competitionId,
    editionId: input.editionId,
    teamId: input.teamId,
    year,
    teamName,
    label: `${teamName} — ${edition.label}`,
    sourceStatus: input.sourceStatus ?? "partiallyVerified",
    playerProfileIds: profileIds,
  };
  SQUAD_REGISTRY.push(squad);
  return squad;
}

/** Convenience: register many squads for one competition/edition. */
export function defineEditionSquads(
  competitionId: CompetitionId,
  editionId: string,
  teams: Record<string, string[]>,
  sourceStatus: SourceStatus = "partiallyVerified",
) {
  for (const [teamId, rows] of Object.entries(teams)) {
    defineSquad({ competitionId, editionId, teamId, rows, sourceStatus });
  }
}