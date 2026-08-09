import { TEAMS, TEAM_BY_ID, teamNameForYear } from "@/data/teams";
import type { Team } from "@/data/model";

export const TeamRepository = {
  listTeams(): Team[] {
    return TEAMS;
  },
  getTeam(id: string): Team | undefined {
    return TEAM_BY_ID.get(id);
  },
  nameForYear(teamId: string, year: number): string {
    return teamNameForYear(teamId, year);
  },
  /** All team ids that belong to the same franchise lineage (handles renames). */
  lineageTeamIds(teamId: string): string[] {
    const team = TEAM_BY_ID.get(teamId);
    if (!team?.franchiseLineageId) return [teamId];
    return TEAMS.filter((t) => t.franchiseLineageId === team.franchiseLineageId).map((t) => t.id);
  },
};
