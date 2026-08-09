import { SQUAD_REGISTRY, PROFILE_REGISTRY } from "@/data/catalog";
import type { CompetitionId, HistoricalSquad, PlayerEditionProfile } from "@/data/model";
import { TeamRepository } from "./TeamRepository";

const byId = new Map(SQUAD_REGISTRY.map((s) => [s.id, s]));

export const SquadRepository = {
  listSquads(): HistoricalSquad[] {
    return SQUAD_REGISTRY;
  },
  countSquads(): number {
    return SQUAD_REGISTRY.length;
  },
  getSquadById(id: string): HistoricalSquad | undefined {
    return byId.get(id);
  },
  getSquadsByCompetition(competitionId: CompetitionId): HistoricalSquad[] {
    return SQUAD_REGISTRY.filter((s) => s.competitionId === competitionId);
  },
  getSquadsByEdition(editionId: string): HistoricalSquad[] {
    return SQUAD_REGISTRY.filter((s) => s.editionId === editionId);
  },
  getSquadsByTeam(teamId: string, competitionId?: CompetitionId): HistoricalSquad[] {
    return SQUAD_REGISTRY.filter(
      (s) => s.teamId === teamId && (!competitionId || s.competitionId === competitionId),
    );
  },
  getPlayersForSquad(squadId: string): PlayerEditionProfile[] {
    const squad = byId.get(squadId);
    if (!squad) return [];
    return squad.playerProfileIds
      .map((id) => PROFILE_REGISTRY.get(id))
      .filter((p): p is PlayerEditionProfile => Boolean(p));
  },

  /**
   * "Same team → different year", scoped to one competition and traversing
   * franchise renames (Kings XI Punjab ↔ Punjab Kings).
   */
  getAlternateYearsForTeam(
    competitionId: CompetitionId,
    teamId: string,
    excludeSquadIds: string[] = [],
  ): HistoricalSquad[] {
    const lineage = new Set(TeamRepository.lineageTeamIds(teamId));
    const excluded = new Set(excludeSquadIds);
    return SQUAD_REGISTRY.filter(
      (s) => s.competitionId === competitionId && lineage.has(s.teamId) && !excluded.has(s.id),
    ).sort((a, b) => a.year - b.year);
  },

  /** "Same year → different team", restricted to actual participants of that edition. */
  getOtherTeamsInEdition(
    competitionId: CompetitionId,
    editionId: string,
    excludeSquadIds: string[] = [],
  ): HistoricalSquad[] {
    const excluded = new Set(excludeSquadIds);
    return SQUAD_REGISTRY.filter(
      (s) => s.competitionId === competitionId && s.editionId === editionId && !excluded.has(s.id),
    );
  },
};
