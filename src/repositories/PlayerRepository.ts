import { PLAYER_REGISTRY, PROFILE_REGISTRY } from "@/data/catalog";
import type { CanonicalPlayer, PlayerEditionProfile } from "@/data/model";

let byPlayerId: Map<string, PlayerEditionProfile[]> | null = null;
function index() {
  if (byPlayerId) return byPlayerId;
  byPlayerId = new Map();
  for (const profile of PROFILE_REGISTRY.values()) {
    const list = byPlayerId.get(profile.playerId);
    if (list) list.push(profile);
    else byPlayerId.set(profile.playerId, [profile]);
  }
  return byPlayerId;
}

export const PlayerRepository = {
  listPlayers(): CanonicalPlayer[] {
    return [...PLAYER_REGISTRY.values()];
  },
  getPlayer(playerId: string): CanonicalPlayer | undefined {
    return PLAYER_REGISTRY.get(playerId);
  },
  getPlayerProfile(profileId: string): PlayerEditionProfile | undefined {
    return PROFILE_REGISTRY.get(profileId);
  },
  getProfilesForPlayer(playerId: string): PlayerEditionProfile[] {
    return index().get(playerId) ?? [];
  },
  countPlayers(): number {
    return PLAYER_REGISTRY.size;
  },
  countProfiles(): number {
    return PROFILE_REGISTRY.size;
  },
};
