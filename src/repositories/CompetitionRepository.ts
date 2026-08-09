import { COMPETITIONS, COMPETITION_BY_ID, EDITIONS, EDITION_BY_ID } from "@/data/competitions";
import type { Competition, CompetitionId, Edition } from "@/data/model";
import type { GameMode } from "@/lib/cricket/types";

export const CompetitionRepository = {
  listCompetitions(): Competition[] {
    return COMPETITIONS;
  },
  getCompetition(id: CompetitionId): Competition | undefined {
    return COMPETITION_BY_ID.get(id);
  },
  getCompetitionForMode(mode: GameMode): Competition | undefined {
    return COMPETITIONS.find((c) => c.mode === mode);
  },
};

export const EditionRepository = {
  listEditions(): Edition[] {
    return EDITIONS;
  },
  getEdition(id: string): Edition | undefined {
    return EDITION_BY_ID.get(id);
  },
  getEditionsForCompetition(competitionId: CompetitionId): Edition[] {
    return EDITIONS.filter((e) => e.competitionId === competitionId).sort(
      (a, b) => a.year - b.year,
    );
  },
};
