import type { GameMode, Squad } from "@/lib/cricket/types";
import { SQUADS_BY_MODE } from "@/lib/cricket/data";
import { HistoricalSquadService, withCanonicalIds } from "./HistoricalSquadService";

const cache = new Map<GameMode, Squad[]>();

/**
 * The single source of draftable squads. Catalogue-backed where history exists,
 * falling back to the legacy seed squads for modes not yet catalogued (Test).
 */
export const DraftPoolService = {
  getPool(mode: GameMode): Squad[] {
    const cached = cache.get(mode);
    if (cached) return cached;
    const historical = HistoricalSquadService.getLegacySquadsForMode(mode);
    const pool = historical.length
      ? historical
      : (SQUADS_BY_MODE[mode] ?? []).map(withCanonicalIds);
    cache.set(mode, pool);
    return pool;
  },
  isHistorical(mode: GameMode): boolean {
    return HistoricalSquadService.getLegacySquadsForMode(mode).length > 0;
  },
};
