import { isOverdue } from "./date";

export type AggTask = {
  id: number;
  status: "TODO" | "DONE";
  dueDate: string;
  estimatedMinutes: number;
  deletedAt: Date | string | null;
};

export type AggWorkLog = {
  id: number;
  taskId: number;
  actualMinutes: number;
  blockerReason: string | null;
};

export interface RetroAggregation {
  plannedCount: number;
  doneCount: number;
  overdueCount: number;
  blockedCount: number;
  estimatedMinutesTotal: number;
  actualMinutesTotal: number;
  diffMinutes: number;
  plannedTaskIds: number[];
  doneTaskIds: number[];
  overdueTaskIds: number[];
  blockedTaskIds: number[];
  actualWorkLogIds: number[];
}

/**
 * Computes all "See" retrospective numbers from a scoped set of (already
 * scope-filtered, e.g. by plan or date range) tasks and the work logs that
 * belong to them. Every returned *count is backed by an id list so the UI
 * can drill into evidence and the total can be verified by summing it.
 *
 * Soft-deleted tasks are always excluded here, regardless of what the
 * caller passed in, so this function is the single source of truth for the
 * "exclude deletedAt" rule everywhere aggregation happens.
 */
export function computeRetroAggregation(
  tasks: AggTask[],
  workLogs: AggWorkLog[],
  todaySeoul: string,
): RetroAggregation {
  const activeTasks = tasks.filter((t) => !t.deletedAt);
  const plannedTaskIds = activeTasks.map((t) => t.id);
  const activeTaskIdSet = new Set(plannedTaskIds);

  const doneTasks = activeTasks.filter((t) => t.status === "DONE");
  const overdueTasks = activeTasks.filter((t) => isOverdue(t.dueDate, t.status, todaySeoul));

  const relevantWorkLogs = workLogs.filter((w) => activeTaskIdSet.has(w.taskId));
  const blockedTaskIdSet = new Set(
    relevantWorkLogs
      .filter((w) => (w.blockerReason ?? "").trim().length > 0)
      .map((w) => w.taskId),
  );

  const estimatedMinutesTotal = activeTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const actualMinutesTotal = relevantWorkLogs.reduce((sum, w) => sum + w.actualMinutes, 0);

  return {
    plannedCount: plannedTaskIds.length,
    doneCount: doneTasks.length,
    overdueCount: overdueTasks.length,
    blockedCount: blockedTaskIdSet.size,
    estimatedMinutesTotal,
    actualMinutesTotal,
    diffMinutes: actualMinutesTotal - estimatedMinutesTotal,
    plannedTaskIds,
    doneTaskIds: doneTasks.map((t) => t.id),
    overdueTaskIds: overdueTasks.map((t) => t.id),
    blockedTaskIds: [...blockedTaskIdSet],
    actualWorkLogIds: relevantWorkLogs.map((w) => w.id),
  };
}
