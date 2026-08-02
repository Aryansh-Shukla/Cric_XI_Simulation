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

/**
 * Rerolls are catalogue queries: same competition only, real editions only,
 * and always an empty array (never undefined) when nothing is eligible.
 */
export const RerollService = {
  /** Same team (following franchise renames) in a different year of the same competition. */
  sameTeamDifferentYear(current: Squad, mode: GameMode, excludeSquadIds: string[] = []): Squad[] {
    const ctx = historicalContext(current);
    if (!ctx) {
      const pool = DraftPoolService.getPool(mode);
      const avoid = new Set([current.id, ...excludeSquadIds]);
      return pool.filter(s => s.country === current.country && !avoid.has(s.id));
    }
    return SquadRepository
      .getAlternateYearsForTeam(ctx.competitionId, ctx.teamId, [current.id, ...excludeSquadIds])
      .map(s => squadToLegacy(s, mode));
  },

  /** A different participant of the exact same edition. */
  sameYearDifferentTeam(current: Squad, mode: GameMode, excludeSquadIds: string[] = []): Squad[] {
    const ctx = historicalContext(current);
    if (!ctx) {
      const pool = DraftPoolService.getPool(mode);
      const avoid = new Set([current.id, ...excludeSquadIds]);
      return pool.filter(s => s.year === current.year && !avoid.has(s.id));
    }
    return SquadRepository
      .getOtherTeamsInEdition(ctx.competitionId, ctx.editionId, [current.id, ...excludeSquadIds])
      .map(s => squadToLegacy(s, mode));
  },
};
