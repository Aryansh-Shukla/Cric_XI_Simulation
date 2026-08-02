import { PLAYER_REGISTRY, PROFILE_REGISTRY, SQUAD_REGISTRY } from "@/data/catalog";
import { EDITION_BY_ID } from "@/data/competitions";
import { TEAM_BY_ID } from "@/data/teams";
import { computeOverall } from "@/data/authoring";
import type { Player } from "./types";
import { canonicalIdOf } from "@/services/PlayerEligibilityService";

export interface ValidationReport {
  ok: boolean;
  counts: {
    players: number;
    profiles: number;
    squads: number;
    editions: number;
    competitions: number;
  };
  errors: string[];
  warnings: string[];
  coverage: { competitionId: string; editions: number; squads: number }[];
}

const inRange = (n: number | undefined) => n === undefined || (n >= 1 && n <= 99);

export function validateCatalog(): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Unique squad ids
  const squadIds = new Set<string>();
  for (const squad of SQUAD_REGISTRY) {
    if (squadIds.has(squad.id)) errors.push(`Duplicate squad id: ${squad.id}`);
    squadIds.add(squad.id);

    if (!EDITION_BY_ID.has(squad.editionId)) errors.push(`${squad.id}: unknown edition ${squad.editionId}`);
    if (!TEAM_BY_ID.has(squad.teamId)) errors.push(`${squad.id}: unknown team ${squad.teamId}`);

    const seen = new Set<string>();
    let keepers = 0;
    let bowlers = 0;
    for (const profileId of squad.playerProfileIds) {
      const profile = PROFILE_REGISTRY.get(profileId);
      if (!profile) {
        errors.push(`${squad.id}: unresolved profile ${profileId}`);
        continue;
      }
      if (!PLAYER_REGISTRY.has(profile.playerId)) {
        errors.push(`${squad.id}: unresolved canonical player ${profile.playerId}`);
      }
      if (seen.has(profile.playerId)) {
        errors.push(`${squad.id}: duplicate player ${profile.name} within squad`);
      }
      seen.add(profile.playerId);

      for (const [key, value] of Object.entries({
        batting: profile.batting, bowling: profile.bowling, fielding: profile.fielding,
        wicketkeeping: profile.wicketkeeping, leadership: profile.leadership,
        pressure: profile.pressure, consistency: profile.consistency,
        fitness: profile.fitness, form: profile.form, overall: profile.overall,
      })) {
        if (!inRange(value as number | undefined)) errors.push(`${profileId}: ${key}=${value} out of range 1–99`);
      }

      const expected = computeOverall(profile.role, profile.batting, profile.bowling, profile.fielding, profile.wicketkeeping);
      if (expected !== profile.overall) {
        errors.push(`${profileId}: overall ${profile.overall} ≠ formula ${expected}`);
      }

      if (profile.canKeepWicket && profile.wicketkeeping === undefined) {
        errors.push(`${profileId}: canKeepWicket without a wicketkeeping rating`);
      }
      if (profile.role === "Wicketkeeper" && !profile.canKeepWicket) {
        errors.push(`${profileId}: wicketkeeper role without canKeepWicket`);
      }
      if (profile.bowlingRole === "specialist" && profile.bowling < 40) {
        warnings.push(`${profileId}: specialist bowler with bowling ${profile.bowling}`);
      }
      if ((profile.role === "PaceBowler" || profile.role === "SpinBowler") && profile.bowlingRole !== "specialist") {
        errors.push(`${profileId}: bowler role without specialist bowlingRole`);
      }

      if (profile.canKeepWicket) keepers++;
      if (profile.bowlingRole === "specialist" || profile.bowlingRole === "allRounder") bowlers++;
    }

    if (keepers === 0) warnings.push(`${squad.id}: no wicketkeeper in squad`);
    if (bowlers < 4) warnings.push(`${squad.id}: only ${bowlers} frontline bowling options`);
  }

  // Canonical players must be unique by id (Map guarantees) but names should not collide across ids
  const nameToIds = new Map<string, string[]>();
  for (const p of PLAYER_REGISTRY.values()) {
    const list = nameToIds.get(p.name) ?? [];
    list.push(p.id);
    nameToIds.set(p.name, list);
  }
  for (const [name, ids] of nameToIds) {
    if (ids.length > 1) errors.push(`Canonical name "${name}" maps to ${ids.length} ids`);
  }

  const competitions = new Set(SQUAD_REGISTRY.map(s => s.competitionId));
  const coverage = [...competitions].map(competitionId => {
    const squads = SQUAD_REGISTRY.filter(s => s.competitionId === competitionId);
    return {
      competitionId,
      editions: new Set(squads.map(s => s.editionId)).size,
      squads: squads.length,
    };
  });

  return {
    ok: errors.length === 0,
    counts: {
      players: PLAYER_REGISTRY.size,
      profiles: PROFILE_REGISTRY.size,
      squads: SQUAD_REGISTRY.length,
      editions: new Set(SQUAD_REGISTRY.map(s => s.editionId)).size,
      competitions: competitions.size,
    },
    errors,
    warnings,
    coverage,
  };
}

/** Runtime guard for a drafted XI: no real cricketer may appear twice. */
export function validateDraftedXI(players: Player[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const p of players) {
    const id = canonicalIdOf(p);
    if (seen.has(id)) errors.push(`Duplicate canonical player in XI: ${p.name}`);
    seen.add(id);
  }
  return errors;
}

export function logValidationReport() {
  const report = validateCatalog();
  const { counts } = report;
  console.groupCollapsed(
    `[Cricket XI] catalogue ${report.ok ? "OK" : "FAILED"} — ` +
    `${counts.players} players · ${counts.profiles} profiles · ${counts.squads} squads · ${counts.editions} editions`,
  );
  console.table(report.coverage);
  if (report.errors.length) console.error(report.errors);
  if (report.warnings.length) console.warn(`${report.warnings.length} warnings`, report.warnings.slice(0, 20));
  console.groupEnd();
  return report;
}
