import { describe, expect, it } from "vitest";
import {
  computeConstellationLayout,
  buildConstellationTasks,
  describeStar,
  ORBIT_RADII,
  type ConstellationTaskInput,
} from "@/lib/constellation";

const PLAN_START = "2026-09-17";
const PLAN_END = "2026-10-31";
const TODAY = "2026-09-17";

function makeTask(overrides: Partial<ConstellationTaskInput> & { id: number }): ConstellationTaskInput {
  return {
    title: `Task ${overrides.id}`,
    status: "TODO",
    priority: "MEDIUM",
    tag: "",
    dueDate: "2026-09-20",
    estimatedMinutes: 60,
    createdAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    actualMinutesTotal: 0,
    workLogCount: 0,
    hasBlocker: false,
    ...overrides,
  };
}

describe("computeConstellationLayout", () => {
  it("returns an empty, non-complete layout for zero tasks", () => {
    const layout = computeConstellationLayout([], PLAN_START, PLAN_END, TODAY);
    expect(layout.stars).toEqual([]);
    expect(layout.connections).toEqual([]);
    expect(layout.isComplete).toBe(false);
  });

  it("is fully deterministic: same input always produces the same coordinates", () => {
    const tasks = [
      makeTask({ id: 1, dueDate: "2026-09-19", estimatedMinutes: 120 }),
      makeTask({ id: 2, dueDate: "2026-10-15", estimatedMinutes: 240 }),
      makeTask({ id: 3, dueDate: "2026-10-28", estimatedMinutes: 30 }),
    ];
    const layoutA = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    const layoutB = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    expect(layoutA.stars).toEqual(layoutB.stars);
  });

  it("does not depend on input array order (position comes from id, not index)", () => {
    const t1 = makeTask({ id: 1, dueDate: "2026-09-19", estimatedMinutes: 120 });
    const t2 = makeTask({ id: 2, dueDate: "2026-10-15", estimatedMinutes: 240 });
    const forward = computeConstellationLayout([t1, t2], PLAN_START, PLAN_END, TODAY);
    const reversed = computeConstellationLayout([t2, t1], PLAN_START, PLAN_END, TODAY);
    expect(forward.stars).toEqual(reversed.stars);
  });

  it("assigns orbit by where the due date falls within the plan's date range", () => {
    const early = makeTask({ id: 1, dueDate: "2026-09-18" }); // near start -> inner
    const mid = makeTask({ id: 2, dueDate: "2026-10-08" }); // middle -> mid orbit
    const late = makeTask({ id: 3, dueDate: "2026-10-30" }); // near end -> outer
    const layout = computeConstellationLayout([early, mid, late], PLAN_START, PLAN_END, TODAY);
    const byId = Object.fromEntries(layout.stars.map((s) => [s.id, s]));
    expect(byId[1].orbit).toBe(0);
    expect(byId[2].orbit).toBe(1);
    expect(byId[3].orbit).toBe(2);
    expect(byId[1].x ** 2 + byId[1].y ** 2).toBeCloseTo(ORBIT_RADII[0] ** 2, 0);
  });

  it("normalizes star radius from estimatedMinutes: bigger estimate -> bigger star", () => {
    const small = makeTask({ id: 1, estimatedMinutes: 15 });
    const big = makeTask({ id: 2, estimatedMinutes: 480 });
    const layout = computeConstellationLayout([small, big], PLAN_START, PLAN_END, TODAY);
    const byId = Object.fromEntries(layout.stars.map((s) => [s.id, s]));
    expect(byId[2].radius).toBeGreaterThan(byId[1].radius);
  });

  it("gives every star the same radius when all estimates tie (no NaN from a zero-width range)", () => {
    const tasks = [makeTask({ id: 1, estimatedMinutes: 60 }), makeTask({ id: 2, estimatedMinutes: 60 })];
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    expect(layout.stars[0].radius).toBe(layout.stars[1].radius);
    expect(Number.isFinite(layout.stars[0].radius)).toBe(true);
  });

  it("marks a task overdue only when TODO and past the Seoul due date, mirroring lib/date isOverdue", () => {
    const overdue = makeTask({ id: 1, status: "TODO", dueDate: "2026-09-01" });
    const doneButPastDue = makeTask({ id: 2, status: "DONE", dueDate: "2026-09-01" });
    const layout = computeConstellationLayout([overdue, doneButPastDue], PLAN_START, PLAN_END, TODAY);
    const byId = Object.fromEntries(layout.stars.map((s) => [s.id, s]));
    expect(byId[1].isOverdue).toBe(true);
    expect(byId[2].isOverdue).toBe(false);
  });

  it("keeps a minimum angular separation between stars sharing an orbit", () => {
    // Many tasks with due dates that land in the same (inner) orbit band.
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ id: i + 1, dueDate: "2026-09-18" }));
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    const sorted = [...layout.stars].sort((a, b) => a.angleDeg - b.angleDeg);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].angleDeg - sorted[i - 1].angleDeg).toBeGreaterThan(0);
    }
  });

  it("connects DONE stars in completedAt order, not id or angle order", () => {
    const tasks = [
      makeTask({ id: 1, status: "DONE", completedAt: "2026-09-20T00:00:00.000Z" }),
      makeTask({ id: 2, status: "DONE", completedAt: "2026-09-18T00:00:00.000Z" }),
      makeTask({ id: 3, status: "TODO" }),
    ];
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    expect(layout.connections).toHaveLength(1);
    expect(layout.connections[0].from.id).toBe(2); // completed first chronologically
    expect(layout.connections[0].to.id).toBe(1);
  });

  it("closes the figure (last -> first) only once every star is DONE and there are 3+ stars", () => {
    const done = (id: number, at: string) => makeTask({ id, status: "DONE", completedAt: at });
    const partial = computeConstellationLayout(
      [done(1, "2026-09-18T00:00:00Z"), done(2, "2026-09-19T00:00:00Z"), makeTask({ id: 3 })],
      PLAN_START,
      PLAN_END,
      TODAY,
    );
    expect(partial.connections).toHaveLength(1); // open chain, not closed

    const complete = computeConstellationLayout(
      [done(1, "2026-09-18T00:00:00Z"), done(2, "2026-09-19T00:00:00Z"), done(3, "2026-09-20T00:00:00Z")],
      PLAN_START,
      PLAN_END,
      TODAY,
    );
    expect(complete.connections).toHaveLength(3); // 1->2, 2->3, and closing 3->1
    const closing = complete.connections[2];
    expect(closing.from.id).toBe(3);
    expect(closing.to.id).toBe(1);

    const twoStars = computeConstellationLayout(
      [done(1, "2026-09-18T00:00:00Z"), done(2, "2026-09-19T00:00:00Z")],
      PLAN_START,
      PLAN_END,
      TODAY,
    );
    expect(twoStars.connections).toHaveLength(1); // a 2-star figure has nothing to close
  });

  it("is complete only when there is at least one task and every task is DONE", () => {
    const allDone = [makeTask({ id: 1, status: "DONE" }), makeTask({ id: 2, status: "DONE" })];
    const mixed = [makeTask({ id: 1, status: "DONE" }), makeTask({ id: 2, status: "TODO" })];
    expect(computeConstellationLayout(allDone, PLAN_START, PLAN_END, TODAY).isComplete).toBe(true);
    expect(computeConstellationLayout(mixed, PLAN_START, PLAN_END, TODAY).isComplete).toBe(false);
  });
});

describe("buildConstellationTasks", () => {
  it("sums actual minutes and counts logs per task, and flags any non-empty blockerReason", () => {
    const tasks = [
      { id: 1, title: "A", status: "TODO" as const, priority: "HIGH" as const, tag: "C", dueDate: "2026-09-20", estimatedMinutes: 60, createdAt: "2026-09-01", completedAt: null },
      { id: 2, title: "B", status: "TODO" as const, priority: "LOW" as const, tag: "", dueDate: "2026-09-20", estimatedMinutes: 60, createdAt: "2026-09-01", completedAt: null },
    ];
    const logs = [
      { taskId: 1, actualMinutes: 30, blockerReason: null },
      { taskId: 1, actualMinutes: 20, blockerReason: "  " }, // blank -> not a real blocker
      { taskId: 1, actualMinutes: 10, blockerReason: "network down" },
    ];
    const result = buildConstellationTasks(tasks, logs);
    const byId = Object.fromEntries(result.map((t) => [t.id, t]));
    expect(byId[1].actualMinutesTotal).toBe(60);
    expect(byId[1].workLogCount).toBe(3);
    expect(byId[1].hasBlocker).toBe(true);
    expect(byId[2].actualMinutesTotal).toBe(0);
    expect(byId[2].workLogCount).toBe(0);
    expect(byId[2].hasBlocker).toBe(false);
  });
});

describe("describeStar", () => {
  it("includes the key fields needed for the hover/focus accessible description", () => {
    const layout = computeConstellationLayout(
      [
        {
          id: 1,
          title: "포인터 복습",
          status: "TODO",
          priority: "HIGH",
          tag: "C",
          dueDate: "2026-09-20",
          estimatedMinutes: 90,
          createdAt: "2026-09-01",
          completedAt: null,
          actualMinutesTotal: 45,
          workLogCount: 2,
          hasBlocker: true,
        },
      ],
      PLAN_START,
      PLAN_END,
      TODAY,
    );
    const desc = describeStar(layout.stars[0]);
    expect(desc).toContain("포인터 복습");
    expect(desc).toContain("진행 중");
    expect(desc).toContain("2026.09.20");
    expect(desc).toContain("막힌 기록 있음");
  });
});
