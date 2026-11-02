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

function isCompletedRun(value: unknown): value is CompletedRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<CompletedRun>;
  return (
    typeof run.id === "string" &&
    run.id.length > 0 &&
    typeof run.teamName === "string" &&
    run.teamName.trim().length > 0 &&
    typeof run.tournament === "string" &&
    run.tournament.trim().length > 0 &&
    typeof run.finalResult === "string" &&
    run.finalResult.trim().length > 0 &&
    typeof run.score === "number" &&
    Number.isFinite(run.score) &&
    run.score >= 0 &&
    Number.isInteger(run.wins) &&
    Number.isInteger(run.losses) &&
    Number.isInteger(run.draws) &&
    (run.wins ?? -1) >= 0 &&
    (run.losses ?? -1) >= 0 &&
    (run.draws ?? -1) >= 0 &&
    typeof run.won === "boolean" &&
    typeof run.date === "string" &&
    Number.isFinite(Date.parse(run.date))
  );
}

function read(): CompletedRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    return parsed.filter((entry): entry is CompletedRun => {
      if (!isCompletedRun(entry) || ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    });
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
  if (!isCompletedRun(record)) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rankRuns([record, ...existing])));
    return true;
  } catch {
    return false;
  }
}
