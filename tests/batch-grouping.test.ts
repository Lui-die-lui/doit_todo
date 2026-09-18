import { describe, expect, it } from "vitest";
import { groupPlanData } from "@/lib/batch-grouping";

describe("groupPlanData", () => {
  it("groups tasks and work logs without changing their order", () => {
    const tasks = [
      { id: 11, planId: 1, title: "first" },
      { id: 21, planId: 2, title: "other" },
      { id: 12, planId: 1, title: "second" },
    ];
    const logs = [
      { id: 101, taskId: 12 },
      { id: 102, taskId: 21 },
      { id: 103, taskId: 11 },
    ];

    const grouped = groupPlanData(tasks, logs);

    expect(grouped.tasksByPlan.get(1)?.map((task) => task.id)).toEqual([11, 12]);
    expect(grouped.tasksByPlan.get(2)?.map((task) => task.id)).toEqual([21]);
    expect(grouped.workLogsByPlan.get(1)?.map((log) => log.id)).toEqual([101, 103]);
    expect(grouped.workLogsByPlan.get(2)?.map((log) => log.id)).toEqual([102]);
  });

  it("ignores logs for tasks outside the selected plan batch", () => {
    const grouped = groupPlanData([{ id: 11, planId: 1 }], [
      { id: 101, taskId: 11 },
      { id: 999, taskId: 999 },
    ]);

    expect(grouped.workLogsByPlan.get(1)?.map((log) => log.id)).toEqual([101]);
    expect([...grouped.workLogsByPlan.values()].flat()).not.toContainEqual({ id: 999, taskId: 999 });
  });
});
