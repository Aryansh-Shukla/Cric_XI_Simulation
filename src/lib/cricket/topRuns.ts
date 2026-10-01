/**
 * Top Runs — every completed campaign (won or lost), persisted locally and
 * ranked by campaign score. No seeded or fictional entries.
 */
export interface CompletedRun {
  /** Stable per-campaign id (tournament seed) — used to prevent duplicates. */
  id: string;
  teamName: string;
  tournament: string;
  finalResult: string; // "Champion", "Finalist", "Eliminated in Group Stage", ...
  score: number;
  wins: number;
  losses: number;
  draws: number;
  won: boolean;
  date: string; // ISO
}

const KEY = "cricketxi.topruns.v1";
const LEGACY_KEY = "cricketxi.champions.v1";
const MAX = 50;

function read(): CompletedRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CompletedRun[]).filter((r) => typeof r?.score === "number") : [];
  } catch {
    return [];
  }
}

/** Score descending; ties broken by earliest date, then id (deterministic). */
export function rankRuns(runs: CompletedRun[]): CompletedRun[] {
  return [...runs].sort(
    (a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}

/** Client-only. Call from an effect, never during render. */
export function listTopRuns(limit = 3): CompletedRun[] {
  return rankRuns(read()).slice(0, limit);
}

/** Records a completed campaign exactly once per id. */
export function recordCompletedRun(run: Omit<CompletedRun, "date"> & { date?: string }): boolean {
  if (typeof window === "undefined") return false;
  const existing = read();
  if (existing.some((r) => r.id === run.id)) return false;
  const record: CompletedRun = { ...run, date: run.date ?? new Date().toISOString() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rankRuns([record, ...existing]).slice(0, MAX)));
    window.localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}
