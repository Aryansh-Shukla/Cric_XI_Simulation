import type { Player } from "@/lib/cricket/types";
import { canonicalPlayerId } from "@/data/authoring";

export const canonicalIdOf = (p: Player) => p.canonicalId ?? canonicalPlayerId(p.name);

/**
 * Canonical enforcement: one real cricketer occupies at most one slot in the XI,
 * no matter which edition profile was drafted.
 */
export const PlayerEligibilityService = {
  canonicalIdOf,
  draftedCanonicalIds(picked: Player[]): Set<string> {
    return new Set(picked.map(canonicalIdOf));
  },
  isAlreadyDrafted(candidate: Player, picked: Player[]): boolean {
    return this.draftedCanonicalIds(picked).has(canonicalIdOf(candidate));
  },
  /** Removes every profile of an already-drafted cricketer from a candidate list. */
  filterEligible(candidates: Player[], picked: Player[]): Player[] {
    const used = this.draftedCanonicalIds(picked);
    const seen = new Set<string>();
    return candidates.filter(p => {
      const id = canonicalIdOf(p);
      if (used.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  },
};
