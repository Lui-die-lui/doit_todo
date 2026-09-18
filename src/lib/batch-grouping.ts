/**
 * Groups the results of batched task/work-log queries back into their plans.
 * Array order is preserved so callers keep the same deterministic task ordering
 * as the query layer.
 */
export function groupPlanData<
  TTask extends { id: number; planId: number },
  TWorkLog extends { taskId: number },
>(tasks: TTask[], workLogs: TWorkLog[]) {
  const tasksByPlan = new Map<number, TTask[]>();
  const planIdByTask = new Map<number, number>();

  for (const task of tasks) {
    const grouped = tasksByPlan.get(task.planId) ?? [];
    grouped.push(task);
    tasksByPlan.set(task.planId, grouped);
    planIdByTask.set(task.id, task.planId);
  }

  const workLogsByPlan = new Map<number, TWorkLog[]>();
  for (const workLog of workLogs) {
    const planId = planIdByTask.get(workLog.taskId);
    if (planId === undefined) continue;
    const grouped = workLogsByPlan.get(planId) ?? [];
    grouped.push(workLog);
    workLogsByPlan.set(planId, grouped);
  }

  return { tasksByPlan, workLogsByPlan };
}
