import { describe, expect, it } from "vitest";
import { computeRetroAggregation, type AggTask, type AggWorkLog } from "@/lib/aggregations";

const today = "2026-09-17";

function task(overrides: Partial<AggTask> & { id: number }): AggTask {
  return {
    status: "TODO",
    dueDate: "2026-09-20",
    estimatedMinutes: 60,
    deletedAt: null,
    ...overrides,
  };
}

describe("computeRetroAggregation", () => {
  it("returns all zeros for an empty scope instead of null/NaN", () => {
    const agg = computeRetroAggregation([], [], today);
    expect(agg).toMatchObject({
      plannedCount: 0,
      doneCount: 0,
      overdueCount: 0,
      blockedCount: 0,
      estimatedMinutesTotal: 0,
      actualMinutesTotal: 0,
      diffMinutes: 0,
    });
  });

  it("excludes soft-deleted tasks from every count", () => {
    const tasks = [
      task({ id: 1, estimatedMinutes: 100 }),
      task({ id: 2, estimatedMinutes: 100, deletedAt: new Date() }),
    ];
    const agg = computeRetroAggregation(tasks, [], today);
    expect(agg.plannedCount).toBe(1);
    expect(agg.estimatedMinutesTotal).toBe(100);
  });

  it("counts done as current status = DONE, not completion-event count", () => {
    const tasks = [task({ id: 1, status: "DONE" }), task({ id: 2, status: "TODO" })];
    const agg = computeRetroAggregation(tasks, [], today);
    expect(agg.doneCount).toBe(1);
    expect(agg.doneTaskIds).toEqual([1]);
  });

  it("overdue = not deleted AND not done AND dueDate before Seoul today", () => {
    const tasks = [
      task({ id: 1, status: "TODO", dueDate: "2026-09-10" }), // overdue
      task({ id: 2, status: "DONE", dueDate: "2026-09-10" }), // done, so not overdue even though date passed
      task({ id: 3, status: "TODO", dueDate: "2026-09-30" }), // future, not overdue
    ];
    const agg = computeRetroAggregation(tasks, [], today);
    expect(agg.overdueCount).toBe(1);
    expect(agg.overdueTaskIds).toEqual([1]);
  });

  it("blocked count is unique tasks with a non-empty blockerReason, not work-log row count", () => {
    const tasks = [task({ id: 1 }), task({ id: 2 })];
    const logs: AggWorkLog[] = [
      { id: 1, taskId: 1, actualMinutes: 30, blockerReason: "막힘 A" },
      { id: 2, taskId: 1, actualMinutes: 30, blockerReason: "막힘 B" }, // same task, second blocked log
      { id: 3, taskId: 2, actualMinutes: 30, blockerReason: "" }, // empty string does not count
      { id: 4, taskId: 2, actualMinutes: 30, blockerReason: null },
    ];
    const agg = computeRetroAggregation(tasks, logs, today);
    expect(agg.blockedCount).toBe(1); // task 1 only, despite 2 blocked logs
    expect(agg.blockedTaskIds).toEqual([1]);
  });

  it("estimated/actual/diff sums match the evidence id lists exactly", () => {
    const tasks = [task({ id: 1, estimatedMinutes: 100 }), task({ id: 2, estimatedMinutes: 50 })];
    const logs: AggWorkLog[] = [
      { id: 1, taskId: 1, actualMinutes: 40, blockerReason: null },
      { id: 2, taskId: 1, actualMinutes: 30, blockerReason: null },
      { id: 3, taskId: 2, actualMinutes: 90, blockerReason: null },
    ];
    const agg = computeRetroAggregation(tasks, logs, today);
    expect(agg.estimatedMinutesTotal).toBe(150);
    expect(agg.actualMinutesTotal).toBe(160);
    expect(agg.diffMinutes).toBe(10);
    expect(agg.actualWorkLogIds.sort()).toEqual([1, 2, 3]);
  });

  it("ignores work logs belonging to tasks outside the scope", () => {
    const tasks = [task({ id: 1, estimatedMinutes: 100 })];
    const logs: AggWorkLog[] = [
      { id: 1, taskId: 1, actualMinutes: 40, blockerReason: null },
      { id: 2, taskId: 999, actualMinutes: 1000, blockerReason: "out of scope" },
    ];
    const agg = computeRetroAggregation(tasks, logs, today);
    expect(agg.actualMinutesTotal).toBe(40);
    expect(agg.blockedCount).toBe(0);
  });
});
