import { describe, expect, it } from "vitest";
import { decideCompletion, decideUncompletion } from "@/lib/completion-logic";

describe("decideCompletion", () => {
  it("increments the completion cycle when TODO", () => {
    const decision = decideCompletion({ status: "TODO", completionCycle: 0 });
    expect(decision).toEqual({ action: "complete", nextCycle: 1 });
  });

  it("re-completing after an uncomplete uses the next cycle number", () => {
    const decision = decideCompletion({ status: "TODO", completionCycle: 3 });
    expect(decision).toEqual({ action: "complete", nextCycle: 4 });
  });

  it("is a no-op when already DONE", () => {
    const decision = decideCompletion({ status: "DONE", completionCycle: 2 });
    expect(decision).toEqual({ action: "already_done" });
  });

  it(
    "demonstrates the race the DB unique constraints must catch: two concurrent " +
      "reads of the same TODO/cycle state both compute the same nextCycle, so the " +
      "application layer alone cannot prevent a duplicate -- only the DB-level " +
      "UNIQUE(task_id, completion_cycle) constraint on completion_events can, by " +
      "rejecting the second insert.",
    () => {
      const staleReadA = { status: "TODO" as const, completionCycle: 5 };
      const staleReadB = { status: "TODO" as const, completionCycle: 5 };

      const decisionA = decideCompletion(staleReadA);
      const decisionB = decideCompletion(staleReadB);

      expect(decisionA).toEqual({ action: "complete", nextCycle: 6 });
      expect(decisionB).toEqual({ action: "complete", nextCycle: 6 });

      // Simulate the DB's UNIQUE(task_id, completion_cycle) constraint: only one
      // insert of (taskId, cycle=6) may ever succeed.
      const completionEventsTable = new Set<string>();
      function tryInsert(taskId: number, cycle: number): boolean {
        const key = `${taskId}:${cycle}`;
        if (completionEventsTable.has(key)) return false;
        completionEventsTable.add(key);
        return true;
      }

      const insertedA = tryInsert(1, decisionA.action === "complete" ? decisionA.nextCycle : -1);
      const insertedB = tryInsert(1, decisionB.action === "complete" ? decisionB.nextCycle : -1);

      expect(insertedA).toBe(true);
      expect(insertedB).toBe(false); // rejected by the unique constraint simulation
      expect(completionEventsTable.size).toBe(1);
    },
  );
});

describe("decideUncompletion", () => {
  it("always resets to TODO with completedAt cleared, never touching cycle/events", () => {
    expect(decideUncompletion()).toEqual({ status: "TODO", completedAt: null });
  });
});
