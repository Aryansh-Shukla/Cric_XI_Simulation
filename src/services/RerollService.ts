import type { CompetitionId } from "@/data/model";
import type { GameMode, Squad } from "@/lib/cricket/types";
import { SquadRepository } from "@/repositories/SquadRepository";
import { squadToLegacy } from "./HistoricalSquadService";
import { DraftPoolService } from "./DraftPoolService";

export const NO_ALTERNATIVE_MESSAGE = "No other eligible season available.";

function historicalContext(squad: Squad) {
  if (!squad.competitionId || !squad.editionId || !squad.teamId) return null;
  return {
    competitionId: squad.competitionId as CompetitionId,
    editionId: squad.editionId,
    teamId: squad.teamId,
  };
}

/** Legacy (uncatalogued) modes such as Test: never leave the player with a dead button. */
function legacyFallback(current: Squad, mode: GameMode, exclude: string[], preferred: (s: Squad) => boolean): Squad[] {
  const pool = DraftPoolService.getPool(mode);
  const avoid = new Set([current.id, ...exclude]);
  const others = pool.filter(s => !avoid.has(s.id));
  const matching = others.filter(preferred);
  if (matching.length) return matching;
  // No exact match in the legacy seed data — shuffle to any other available squad.
  return others.length ? others : pool.filter(s => s.id !== current.id);
}

/**
 * Rerolls are catalogue queries: same competition only, real editions only,
 * and always an empty array (never undefined) when nothing is eligible.
 */
export const RerollService = {
  /** Same team (following franchise renames) in a different year of the same competition. */
  sameTeamDifferentYear(current: Squad, mode: GameMode, excludeSquadIds: string[] = []): Squad[] {
    const ctx = historicalContext(current);
    if (!ctx) {
      return legacyFallback(current, mode, excludeSquadIds, s => s.country === current.country);
    }
    return SquadRepository
      .getAlternateYearsForTeam(ctx.competitionId, ctx.teamId, [current.id, ...excludeSquadIds])
      .map(s => squadToLegacy(s, mode));
  },

  /** A different participant of the exact same edition. */
  sameYearDifferentTeam(current: Squad, mode: GameMode, excludeSquadIds: string[] = []): Squad[] {
    const ctx = historicalContext(current);
    if (!ctx) {
      return legacyFallback(current, mode, excludeSquadIds, s => s.year === current.year);
    }
    return SquadRepository
      .getOtherTeamsInEdition(ctx.competitionId, ctx.editionId, [current.id, ...excludeSquadIds])
      .map(s => squadToLegacy(s, mode));
  },
};
