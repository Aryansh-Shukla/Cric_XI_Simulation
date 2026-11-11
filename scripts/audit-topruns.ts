import { strict as assert } from "node:assert";
import { listTopRuns, recordCompletedRun, type CompletedRun } from "../src/lib/cricket/topRuns";

const originalWindow = globalThis.window;

function installStorage(initial: string | null = null) {
  let value = initial;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => value,
        setItem: (_key: string, next: string) => {
          value = next;
        },
      },
    },
  });
  return () => value;
}

function completedRun(overrides: Partial<CompletedRun> = {}): CompletedRun {
  return {
    id: "run-1",
    teamName: "Legends XI",
    tournament: "ODI World Cup",
    finalResult: "Eliminated in League Stage",
    score: 120,
    wins: 2,
    losses: 3,
    draws: 0,
    won: false,
    date: "2026-10-13T00:00:00.000Z",
    ...overrides,
  };
}

function restoreWindow(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
}

function testMalformedAndDuplicateRecords(): void {
  try {
    installStorage(
      JSON.stringify([
        completedRun(),
        { ...completedRun(), score: "120" },
        { ...completedRun(), id: "run-2", date: "not-a-date" },
        completedRun({ teamName: "A duplicate" }),
      ]),
    );

    const runs = listTopRuns();
    assert(runs.length === 1, "malformed and duplicate records should be filtered");
    assert(runs[0]?.teamName === "Legends XI", "the first valid record should remain");
  } finally {
    restoreWindow();
  }
}

function testDeduplicationAndScoreRanking(): void {
  try {
    const readStorage = installStorage();
    assert(recordCompletedRun(completedRun({ id: "low", score: 80 })), "low run should save");
    assert(
      recordCompletedRun(completedRun({ id: "high", score: 140, won: true })),
      "high run should save",
    );
    assert(
      !recordCompletedRun(completedRun({ id: "high", score: 140, won: true })),
      "duplicate run id should be rejected",
    );

    assert(
      listTopRuns()
        .map((run) => run.id)
        .join(",") === "high,low",
      "completed runs should rank by descending score",
    );
    assert(JSON.parse(readStorage() ?? "[]").length === 2, "only unique runs should be stored");
  } finally {
    restoreWindow();
  }
}

testMalformedAndDuplicateRecords();
testDeduplicationAndScoreRanking();
console.log("Top Runs integrity: 2 checks passed");
