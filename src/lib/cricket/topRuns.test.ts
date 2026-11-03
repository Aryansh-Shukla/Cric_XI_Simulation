import { afterEach, describe, expect, test } from "bun:test";
import { listTopRuns, recordCompletedRun, type CompletedRun } from "./topRuns";

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

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("Top Runs local history", () => {
  test("ignores malformed and duplicate stored records", () => {
    installStorage(
      JSON.stringify([
        completedRun(),
        { ...completedRun(), score: "120" },
        { ...completedRun(), id: "run-2", date: "not-a-date" },
        completedRun({ teamName: "A duplicate" }),
      ]),
    );

    expect(listTopRuns()).toHaveLength(1);
    expect(listTopRuns()[0]?.teamName).toBe("Legends XI");
  });

  test("records each completed run once and ranks by score", () => {
    const readStorage = installStorage();
    expect(recordCompletedRun(completedRun({ id: "low", score: 80 }))).toBe(true);
    expect(recordCompletedRun(completedRun({ id: "high", score: 140, won: true }))).toBe(true);
    expect(recordCompletedRun(completedRun({ id: "high", score: 140, won: true }))).toBe(
      false,
    );

    expect(listTopRuns().map((run) => run.id)).toEqual(["high", "low"]);
    expect(JSON.parse(readStorage() ?? "[]")).toHaveLength(2);
  });
});