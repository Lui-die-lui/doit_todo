import { describe, expect, it } from "vitest";
import { compareTasksDefaultOrder, type SortableTask } from "@/lib/tasks-sort";

function t(overrides: Partial<SortableTask> & { id: number }): SortableTask {
  return {
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "2026-09-20",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("compareTasksDefaultOrder", () => {
  it("puts incomplete tasks before done tasks regardless of other fields", () => {
    const done = t({ id: 1, status: "DONE", priority: "HIGH", dueDate: "2026-01-01" });
    const todo = t({ id: 2, status: "TODO", priority: "LOW", dueDate: "2026-12-31" });
    expect([done, todo].sort(compareTasksDefaultOrder)).toEqual([todo, done]);
  });

  it("orders by priority HIGH -> MEDIUM -> LOW within the same status", () => {
    const low = t({ id: 1, priority: "LOW" });
    const high = t({ id: 2, priority: "HIGH" });
    const medium = t({ id: 3, priority: "MEDIUM" });
    expect([low, high, medium].sort(compareTasksDefaultOrder).map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it("orders by due date ascending within the same status+priority", () => {
    const later = t({ id: 1, dueDate: "2026-10-01" });
    const sooner = t({ id: 2, dueDate: "2026-09-01" });
    expect([later, sooner].sort(compareTasksDefaultOrder).map((x) => x.id)).toEqual([2, 1]);
  });

  it("orders by createdAt ascending when status/priority/dueDate all tie", () => {
    const newer = t({ id: 1, createdAt: "2026-09-05T00:00:00.000Z" });
    const older = t({ id: 2, createdAt: "2026-09-01T00:00:00.000Z" });
    expect([newer, older].sort(compareTasksDefaultOrder).map((x) => x.id)).toEqual([2, 1]);
  });

  it("falls back to id ascending as the final, deterministic tiebreaker", () => {
    const a = t({ id: 5 });
    const b = t({ id: 2 });
    // everything else identical -- only id differs
    expect([a, b].sort(compareTasksDefaultOrder).map((x) => x.id)).toEqual([2, 5]);
  });

  it("produces a stable result across repeated sorts of fully-tied input", () => {
    const items = [t({ id: 3 }), t({ id: 1 }), t({ id: 2 })];
    const first = [...items].sort(compareTasksDefaultOrder).map((x) => x.id);
    const second = [...items].sort(compareTasksDefaultOrder).map((x) => x.id);
    expect(first).toEqual([1, 2, 3]);
    expect(second).toEqual(first);
  });
});
