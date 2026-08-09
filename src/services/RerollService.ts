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
 * Legacy (uncatalogued) modes such as Test. The reroll invariant is never broken:
 * only squads that satisfy `preferred` are ever returned. If the exclusion list
 * empties the set we relax the exclusions (but not the invariant) before giving up.
 */
function legacyFallback(
  current: Squad,
  mode: GameMode,
  exclude: string[],
  preferred: (s: Squad) => boolean,
): Squad[] {
  const pool = DraftPoolService.getPool(mode);
  const avoid = new Set([current.id, ...exclude]);
  const eligible = pool.filter((s) => s.id !== current.id && preferred(s));
  const fresh = eligible.filter((s) => !avoid.has(s.id));
  return fresh.length ? fresh : eligible;
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
      return legacyFallback(current, mode, excludeSquadIds, (s) => s.country === current.country);
    }
    const alternates = SquadRepository.getAlternateYearsForTeam(ctx.competitionId, ctx.teamId, [
      current.id,
    ])
      .map((s) => squadToLegacy(s, mode))
      // Invariant: the team must stay identical, only the edition may change.
      .filter(
        (s) => s.competitionId === current.competitionId && s.editionId !== current.editionId,
      );
    const excluded = new Set(excludeSquadIds);
    const fresh = alternates.filter((s) => !excluded.has(s.id));
    return fresh.length ? fresh : alternates;
  },

  /** A different participant of the exact same edition. */
  sameYearDifferentTeam(current: Squad, mode: GameMode, excludeSquadIds: string[] = []): Squad[] {
    const ctx = historicalContext(current);
    if (!ctx) {
      return legacyFallback(current, mode, excludeSquadIds, (s) => s.year === current.year);
    }
    const alternates = SquadRepository.getOtherTeamsInEdition(ctx.competitionId, ctx.editionId, [
      current.id,
    ])
      .map((s) => squadToLegacy(s, mode))
      // Invariant: the edition must stay identical, only the team may change.
      .filter((s) => s.editionId === current.editionId && s.teamId !== current.teamId);
    const excluded = new Set(excludeSquadIds);
    const fresh = alternates.filter((s) => !excluded.has(s.id));
    return fresh.length ? fresh : alternates;
  },
};
