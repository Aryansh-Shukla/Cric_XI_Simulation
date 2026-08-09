import type { HistoricalSquad, PlayerEditionProfile } from "@/data/model";
import type { GameMode, Player, Squad } from "@/lib/cricket/types";
import { CompetitionRepository } from "@/repositories/CompetitionRepository";
import { SquadRepository } from "@/repositories/SquadRepository";
import { canonicalPlayerId } from "@/data/authoring";

/** Adapter: a historical profile rendered as the engine-level Player. */
export function profileToPlayer(profile: PlayerEditionProfile): Player {
  return {
    id: profile.id,
    canonicalId: profile.playerId,
    name: profile.name,
    country: profile.nationality,
    role: profile.role,
    isCaptain: profile.historicalCaptain,
    isOverseas: profile.isOverseas,
    traits: profile.traits,
    stats: {
      batting: profile.batting,
      bowling: profile.bowling,
      fielding: profile.fielding,
      leadership: profile.leadership,
      pressure: profile.pressure,
      consistency: profile.consistency,
      fitness: profile.fitness,
      form: profile.form,
    },
  };
}

/** Adapter: a historical squad rendered as the engine-level Squad. */
export function squadToLegacy(squad: HistoricalSquad, mode: GameMode): Squad {
  return {
    id: squad.id,
    label: squad.label,
    country: squad.teamName,
    year: squad.year,
    mode,
    competitionId: squad.competitionId,
    editionId: squad.editionId,
    teamId: squad.teamId,
    players: SquadRepository.getPlayersForSquad(squad.id).map(profileToPlayer),
  };
}

/** Backfills canonical ids onto legacy (non-catalogue) squads so dedupe still works. */
export function withCanonicalIds(squad: Squad): Squad {
  return {
    ...squad,
    players: squad.players.map((p) => ({
      ...p,
      canonicalId: p.canonicalId ?? canonicalPlayerId(p.name),
    })),
  };
}

export const HistoricalSquadService = {
  profileToPlayer,
  squadToLegacy,
  withCanonicalIds,
  /** Every catalogue squad playable in this mode, as engine squads. */
  getLegacySquadsForMode(mode: GameMode): Squad[] {
    const competition = CompetitionRepository.getCompetitionForMode(mode);
    if (!competition) return [];
    return SquadRepository.getSquadsByCompetition(competition.id).map((s) =>
      squadToLegacy(s, mode),
    );
  },
};
