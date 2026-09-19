import { describe, expect, it } from "vitest";
import {
  computeConstellationLayout,
  buildConstellationTasks,
  describeStar,
  groupCompletedStarsForConnections,
  ORBIT_RADII,
  type ConstellationStar,
  type ConstellationTaskInput,
} from "@/lib/constellation";

const PLAN_START = "2026-09-17";
const PLAN_END = "2026-10-31";
const TODAY = "2026-09-17";

/** A connection group's edges must form a valid spanning tree over exactly its own stars:
 * n-1 edges, every star covered, no duplicate edges, no self-loop, and no cycle (checked via
 * union-find) -- true regardless of which specific tree the MST implementation picks. */
function expectSpanningTree(connections: { from: { id: number }; to: { id: number } }[], starIds: number[]) {
  expect(connections).toHaveLength(starIds.length - 1);
  const parent = new Map(starIds.map((id) => [id, id]));
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const seen = new Set<string>();
  for (const { from, to } of connections) {
    expect(from.id).not.toBe(to.id); // no self-loop
    const key = [from.id, to.id].sort().join("-");
    expect(seen.has(key)).toBe(false); // no duplicate edge
    seen.add(key);
    const [ra, rb] = [find(from.id), find(to.id)];
    expect(ra).not.toBe(rb); // no cycle
    parent.set(ra, rb);
  }
  const root = find(starIds[0]);
  for (const id of starIds) expect(find(id)).toBe(root); // fully connected
}

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

  it("connects a group's DONE stars into a valid spanning tree over their real screen coordinates", () => {
    const tasks = [
      makeTask({ id: 1, status: "DONE", completedAt: "2026-09-22T00:00:00.000Z" }),
      makeTask({ id: 2, status: "DONE", completedAt: "2026-09-18T00:00:00.000Z" }),
      makeTask({ id: 3, status: "DONE", completedAt: "2026-09-20T00:00:00.000Z" }),
      makeTask({ id: 4, status: "DONE", completedAt: "2026-09-21T00:00:00.000Z" }),
      makeTask({ id: 5, status: "TODO" }),
    ];
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    expectSpanningTree(layout.connections, [1, 2, 3, 4]);
    // Every edge should actually be the shortest available link between its two stars'
    // sides of the tree -- not simply completion order (2->3->4->1) or id/array order.
    expect(layout.connections.map((c) => [c.from.id, c.to.id])).not.toEqual([
      [2, 3],
      [3, 4],
      [4, 1],
    ]);
  });

  it("produces the exact same star coordinates and connections on repeated calls (seeded, not Math.random)", () => {
    const tasks = [
      makeTask({ id: 1, status: "DONE", completedAt: "2026-09-18T00:00:00.000Z" }),
      makeTask({ id: 2, status: "DONE", completedAt: "2026-09-18T00:00:00.000Z" }),
      makeTask({ id: 3, status: "DONE", completedAt: "2026-09-19T00:00:00.000Z" }),
      makeTask({ id: 4, status: "DONE", completedAt: "2026-09-20T00:00:00.000Z" }),
      makeTask({ id: 5, status: "DONE", completedAt: "2026-09-21T00:00:00.000Z" }),
    ];
    const layoutA = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    const layoutB = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    expect(layoutA.stars).toEqual(layoutB.stars);
    expect(layoutA.connections.map((c) => [c.from.id, c.to.id])).toEqual(
      layoutB.connections.map((c) => [c.from.id, c.to.id]),
    );
  });

  it("clusters a group's DONE stars into one bounded angular wedge instead of scattering them", () => {
    // 5 DONE stars, all sharing one connection group -- their angles should span far less
    // than the full circle (unlike the old golden-angle-by-id spread, which could land
    // anywhere in [0, 360)).
    const tasks = [1, 2, 3, 4, 5].map((id) => makeTask({ id, status: "DONE", completedAt: "2026-09-18T00:00:00Z" }));
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    const angles = layout.stars.map((s) => s.angleDeg);
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThan(150);
  });

  it("draws no connections when fewer than 4 stars are DONE (an in-progress, not-yet-formed group)", () => {
    const done = (id: number, at: string) => makeTask({ id, status: "DONE", completedAt: at });
    for (const doneTasks of [
      [done(1, "2026-09-18T00:00:00Z")],
      [done(1, "2026-09-18T00:00:00Z"), done(2, "2026-09-19T00:00:00Z")],
      [done(1, "2026-09-18T00:00:00Z"), done(2, "2026-09-19T00:00:00Z"), done(3, "2026-09-20T00:00:00Z")],
    ]) {
      const layout = computeConstellationLayout(doneTasks, PLAN_START, PLAN_END, TODAY);
      expect(layout.connections).toHaveLength(0);
      expect(layout.stars).toHaveLength(doneTasks.length); // stars still render
    }
  });

  it("never closes the loop (last -> first), even once every star is DONE", () => {
    const done = (id: number, at: string) => makeTask({ id, status: "DONE", completedAt: at });
    const complete = computeConstellationLayout(
      [
        done(1, "2026-09-18T00:00:00Z"),
        done(2, "2026-09-19T00:00:00Z"),
        done(3, "2026-09-20T00:00:00Z"),
        done(4, "2026-09-21T00:00:00Z"),
      ],
      PLAN_START,
      PLAN_END,
      TODAY,
    );
    expect(complete.isComplete).toBe(true);
    // A tree over 4 stars has exactly 3 edges -- nothing extra closing the figure back to
    // its first star, and no cycle at all (expectSpanningTree also rejects cycles).
    expectSpanningTree(complete.connections, [1, 2, 3, 4]);
  });

  it("cuts the connection group when the next completion date would push it past 7 stars", () => {
    const done = (id: number, at: string) => makeTask({ id, status: "DONE", completedAt: at });
    // 5 stars on day 1, 4 stars on day 2 -- 5 + 4 = 9 > 7, so day 2 starts a new group
    // instead of continuing day 1's group.
    const tasks = [
      ...[1, 2, 3, 4, 5].map((id) => done(id, "2026-09-18T00:00:00Z")),
      ...[6, 7, 8, 9].map((id) => done(id, "2026-09-19T00:00:00Z")),
    ];
    const layout = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
    // group 1 (ids 1-5) and group 2 (ids 6-9) are each their own spanning tree, and no edge
    // joins a star from one group to a star from the other.
    const group1 = new Set([1, 2, 3, 4, 5]);
    const inGroup1 = layout.connections.filter((c) => group1.has(c.from.id) && group1.has(c.to.id));
    const inGroup2 = layout.connections.filter((c) => !group1.has(c.from.id) && !group1.has(c.to.id));
    expectSpanningTree(inGroup1, [1, 2, 3, 4, 5]);
    expectSpanningTree(inGroup2, [6, 7, 8, 9]);
    expect(layout.connections).toHaveLength(inGroup1.length + inGroup2.length); // nothing bridging
  });

  describe("MST layout quality", () => {
    type Pt = { x: number; y: number };
    const orient = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const properlyCross = (a: Pt, b: Pt, c: Pt, d: Pt) =>
      orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
    const distToSegment = (p: Pt, a: Pt, b: Pt) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    // Realistic diary-sized shapes: a few days, a handful of stars per day, plus open tasks.
    const scenarios: Record<string, number[]> = {
      "one group of 5": [1, 1, 1, 1, 1],
      "one group of 7": [2, 2, 3],
      "two groups": [5, 4],
      "three groups": [6, 5, 4],
      "four groups": [7, 6, 5, 7],
    };
    const build = (perDay: number[]) => {
      const tasks: ConstellationTaskInput[] = [];
      let id = 3;
      perDay.forEach((count, day) => {
        for (let i = 0; i < count; i++, id++) {
          tasks.push(
            makeTask({
              id,
              status: "DONE",
              dueDate: `2026-${day % 2 === 0 ? "09-2" : "10-1"}${i % 10}`, // spread across orbit rings
              estimatedMinutes: 30 + ((id * 37) % 200),
              completedAt: `2026-09-${String(18 + day).padStart(2, "0")}T03:00:00Z`,
            }),
          );
        }
      });
      tasks.push(makeTask({ id: id + 1, status: "TODO" }), makeTask({ id: id + 2, status: "TODO", dueDate: "2026-10-25" }));
      return tasks;
    };

    it.each(Object.entries(scenarios))("has no crossing lines and no line running over a star: %s", (_name, perDay) => {
      const { stars, connections } = computeConstellationLayout(build(perDay), PLAN_START, PLAN_END, TODAY);
      for (let i = 0; i < connections.length; i++) {
        const a = connections[i];
        for (let j = i + 1; j < connections.length; j++) {
          expect(properlyCross(a.from, a.to, connections[j].from, connections[j].to)).toBe(false);
        }
        for (const star of stars) {
          if (star.id === a.from.id || star.id === a.to.id) continue;
          expect(distToSegment(star, a.from, a.to)).toBeGreaterThan(star.radius);
        }
      }
    });

    it.each(Object.entries(scenarios))("keeps every line off the chart center: %s", (_name, perDay) => {
      const { connections } = computeConstellationLayout(build(perDay), PLAN_START, PLAN_END, TODAY);
      for (const c of connections) expect(distToSegment({ x: 0, y: 0 }, c.from, c.to)).toBeGreaterThan(15);
    });

    it("keeps each star's orbit ring (its due-date meaning), moving it at most a few units off the ring", () => {
      const tasks = build([5, 4]);
      const { stars } = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
      const totalDays = 44; // 2026-09-17 .. 2026-10-31
      for (const star of stars) {
        const offsetDays = Math.min(
          totalDays,
          Math.max(0, Math.round((Date.parse(`${star.dueDate}T00:00:00Z`) - Date.parse(`${PLAN_START}T00:00:00Z`)) / 86_400_000)),
        );
        const fraction = offsetDays / totalDays;
        const expectedOrbit = fraction < 1 / 3 ? 0 : fraction < 2 / 3 ? 1 : 2;
        expect(star.orbit).toBe(expectedOrbit);
        const distanceFromCenter = Math.hypot(star.x, star.y);
        expect(Math.abs(distanceFromCenter - ORBIT_RADII[star.orbit])).toBeLessThanOrEqual(6 + 1e-9);
      }
    });

    it("leaves TODO stars exactly on their ring (only DONE stars in a group get any radius nudge)", () => {
      const { stars } = computeConstellationLayout(build([5, 4]), PLAN_START, PLAN_END, TODAY);
      for (const star of stars.filter((s) => s.status === "TODO")) {
        expect(Math.hypot(star.x, star.y)).toBeCloseTo(ORBIT_RADII[star.orbit], 6);
      }
    });

    it("gives two groups separate wedges of the chart rather than overlapping regions", () => {
      const { stars } = computeConstellationLayout(build([5, 4]), PLAN_START, PLAN_END, TODAY);
      const angles = (ids: number[]) => stars.filter((s) => ids.includes(s.id)).map((s) => s.angleDeg);
      const first = angles([3, 4, 5, 6, 7]);
      const second = angles([8, 9, 10, 11]);
      const overlaps = Math.min(...first) <= Math.max(...second) && Math.min(...second) <= Math.max(...first);
      expect(overlaps).toBe(false);
    });

    it("does not lay different groups out as the same repeated shape", () => {
      // Same group size and identical due dates, so any difference is purely the seeded
      // rotation / mirror / per-star jitter -- normalized by each group's own center of mass.
      const shape = (ids: number[], layoutStars: ConstellationStar[]) => {
        const members = layoutStars.filter((s) => ids.includes(s.id));
        const cx = members.reduce((sum, s) => sum + s.x, 0) / members.length;
        const cy = members.reduce((sum, s) => sum + s.y, 0) / members.length;
        return members.map((s) => Math.hypot(s.x - cx, s.y - cy)).sort((a, b) => a - b).map((d) => Math.round(d));
      };
      const tasks = [
        ...[3, 4, 5, 6].map((id) => makeTask({ id, status: "DONE", completedAt: "2026-09-18T03:00:00Z" })),
        ...[7, 8, 9, 10].map((id) => makeTask({ id, status: "DONE", completedAt: "2026-09-19T03:00:00Z" })),
        ...[11, 12, 13, 14].map((id) => makeTask({ id, status: "DONE", completedAt: "2026-09-20T03:00:00Z" })),
      ];
      const { stars } = computeConstellationLayout(tasks, PLAN_START, PLAN_END, TODAY);
      const shapes = [shape([3, 4, 5, 6], stars), shape([7, 8, 9, 10], stars), shape([11, 12, 13, 14], stars)].map((s) =>
        s.join(","),
      );
      expect(new Set(shapes).size).toBe(3);
    });
  });

  it("is complete only when there is at least one task and every task is DONE", () => {
    const allDone = [makeTask({ id: 1, status: "DONE" }), makeTask({ id: 2, status: "DONE" })];
    const mixed = [makeTask({ id: 1, status: "DONE" }), makeTask({ id: 2, status: "TODO" })];
    expect(computeConstellationLayout(allDone, PLAN_START, PLAN_END, TODAY).isComplete).toBe(true);
    expect(computeConstellationLayout(mixed, PLAN_START, PLAN_END, TODAY).isComplete).toBe(false);
  });
});

describe("groupCompletedStarsForConnections", () => {
  function makeStar(id: number, completedAt: string): ConstellationStar {
    return {
      id,
      title: `Star ${id}`,
      x: 0,
      y: 0,
      radius: 3,
      angleDeg: 0,
      orbit: 0,
      status: "DONE",
      priority: "MEDIUM",
      tag: "",
      dueDate: "2026-09-20",
      estimatedMinutes: 60,
      actualMinutesTotal: 0,
      workLogCount: 0,
      completedAt,
      hasBlocker: false,
      isOverdue: false,
    };
  }

  it("returns no groups for an empty list", () => {
    expect(groupCompletedStarsForConnections([])).toEqual([]);
  });

  it("keeps stars completed on the same Seoul date in one group", () => {
    const stars = [1, 2, 3].map((id) => makeStar(id, "2026-09-18T02:00:00.000Z")); // same Seoul day
    const groups = groupCompletedStarsForConnections(stars);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("folds consecutive dates into one group while the running total stays at or under 7", () => {
    const stars = [
      makeStar(1, "2026-09-18T00:00:00Z"),
      makeStar(2, "2026-09-18T00:00:00Z"),
      makeStar(3, "2026-09-19T00:00:00Z"),
      makeStar(4, "2026-09-19T00:00:00Z"),
      makeStar(5, "2026-09-20T00:00:00Z"),
    ];
    const groups = groupCompletedStarsForConnections(stars);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(5);
  });

  it("starts a new group once the next date would push the running total past 7", () => {
    const stars = [
      ...[1, 2, 3, 4].map((id) => makeStar(id, "2026-09-18T00:00:00Z")),
      ...[5, 6, 7].map((id) => makeStar(id, "2026-09-19T00:00:00Z")), // 4 + 3 = 7, still fits
      ...[8, 9].map((id) => makeStar(id, "2026-09-20T00:00:00Z")), // 7 + 2 = 9, cut here
    ];
    const groups = groupCompletedStarsForConnections(stars);
    expect(groups.map((g) => g.map((s) => s.id))).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9],
    ]);
  });

  it.each([
    [8, [4, 4]],
    [9, [5, 4]],
    [10, [5, 5]],
    [14, [7, 7]],
  ])("splits a single date with %i stars into %j", (count, expectedSizes) => {
    const stars = Array.from({ length: count }, (_, i) => makeStar(i + 1, "2026-09-18T00:00:00Z"));
    const groups = groupCompletedStarsForConnections(stars);
    expect(groups.map((g) => g.length)).toEqual(expectedSizes);
    // every star still appears, in completion order, across the split groups
    expect(groups.flat().map((s) => s.id)).toEqual(stars.map((s) => s.id));
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
