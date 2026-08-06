/**
 * Champions feed — real campaign completion records persisted locally.
 * Seeded sample entries share the exact shape of real records, so the feed
 * never shows generic usernames or filler.
 */
export interface ChampionEntry {
  id: string;
  teamName: string;
  tournament: string;
  achievement: string;
  score: number;
  date: string; // ISO
}

const KEY = "cricketxi.champions.v1";
const MAX = 12;

const SEED: ChampionEntry[] = [
  { id: "seed-1", teamName: "Mumbai Mavericks", tournament: "Franchise League 2023", achievement: "Won Franchise League 2023", score: 9420, date: "2023-05-28T00:00:00.000Z" },
  { id: "seed-2", teamName: "Invincibles XI",   tournament: "ODI World Cup 2011",    achievement: "Won ODI World Cup 2011",    score: 8870, date: "2011-04-02T00:00:00.000Z" },
  { id: "seed-3", teamName: "Karachi Kingsmen", tournament: "T20 World Cup 2009",    achievement: "Won T20 World Cup 2009",    score: 8410, date: "2009-06-21T00:00:00.000Z" },
];

function safeRead(): ChampionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChampionEntry[]) : [];
  } catch {
    return [];
  }
}

/** Real entries first (newest first); seeded samples fill the remainder. */
export function listChampions(limit = 3): ChampionEntry[] {
  const real = safeRead().sort((a, b) => b.date.localeCompare(a.date));
  return [...real, ...SEED].slice(0, limit);
}

export function recordChampion(entry: Omit<ChampionEntry, "id" | "date"> & { date?: string }): void {
  if (typeof window === "undefined") return;
  const record: ChampionEntry = {
    ...entry,
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: entry.date ?? new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify([record, ...safeRead()].slice(0, MAX)));
  } catch {
    /* storage unavailable — feed simply falls back to seeded samples */
  }
}
