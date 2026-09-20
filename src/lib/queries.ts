import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { completionEvents, planRevisions, plans, reflections, tasks, workLogs } from "@/db/schema";
import { compareTasksDefaultOrder } from "./tasks-sort";

/**
 * Every function here takes the caller's verified session `userId` and filters by it --
 * tasks/work logs/etc. are owned transitively through their parent plan (see
 * CLAUDE.md 5.1). Nothing in this file trusts an id alone; a mismatched userId simply
 * yields no rows, which callers turn into a 404/empty state rather than a 403, so a
 * plan/task's existence isn't leaked to a non-owner.
 */

/**
 * The one plan order the app uses, so the /plans list and the home carousel can never
 * disagree: the owner's manual order first (sort_order, smallest first), then plans nobody
 * has ever reordered (sort_order NULL) newest first, id as the final tiebreaker.
 */
export const PLAN_ORDER = [sql`${plans.sortOrder} asc nulls last`, desc(plans.createdAt), asc(plans.id)] as const;

export async function getActivePlans(userId: string) {
  return db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), isNull(plans.deletedAt)))
    .orderBy(...PLAN_ORDER);
}

/** Picks the home-screen plan from an already-fetched active list: one whose date range covers today (Seoul), else the most recently created. */
export function pickHomePlan<T extends { startDate: string; endDate: string; createdAt: string | Date }>(
  active: T[],
  todaySeoul: string,
): T | null {
  if (active.length === 0) return null;
  const current = active.find((p) => p.startDate <= todaySeoul && todaySeoul <= p.endDate);
  if (current) return current;
  return [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

/** The plan to show on the home screen: one whose date range covers today (Seoul), else the most recently created active plan. */
export async function getHomePlan(userId: string, todaySeoul: string) {
  const active = await getActivePlans(userId);
  return pickHomePlan(active, todaySeoul);
}

/** Every plan of the owner, archived ones included -- active plans first in PLAN_ORDER, then
 * the archived ones (they can't be reordered, so they trail the list in the same order). */
export async function getAllPlans(userId: string) {
  return db
    .select()
    .from(plans)
    .where(eq(plans.userId, userId))
    .orderBy(sql`${plans.deletedAt} is not null`, ...PLAN_ORDER);
}

export async function getPlanById(userId: string, planId: number) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  return plan ?? null;
}

export async function getPlanRevisions(userId: string, planId: number) {
  return db
    .select({ revision: planRevisions })
    .from(planRevisions)
    .innerJoin(plans, eq(planRevisions.planId, plans.id))
    .where(and(eq(planRevisions.planId, planId), eq(plans.userId, userId)))
    .orderBy(desc(planRevisions.version))
    .then((rows) => rows.map((r) => r.revision));
}

/** Revision counts for a plan list in one round trip. */
export async function getPlanRevisionCounts(userId: string, planIds: number[]) {
  if (planIds.length === 0) return new Map<number, number>();

  const rows = await db
    .select({
      planId: planRevisions.planId,
      count: sql<number>`count(*)::int`,
    })
    .from(planRevisions)
    .innerJoin(plans, eq(planRevisions.planId, plans.id))
    .where(and(inArray(planRevisions.planId, planIds), eq(plans.userId, userId)))
    .groupBy(planRevisions.planId);

  return new Map(rows.map((row) => [row.planId, row.count]));
}

export async function getActiveTasksForPlan(userId: string, planId: number) {
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(tasks.planId, planId), eq(plans.userId, userId), isNull(tasks.deletedAt)))
    .then((rows) => rows.map((r) => r.task));
  return [...rows].sort(compareTasksDefaultOrder);
}

/** Active tasks for many owned plans in one query, preserving the per-plan default order. */
export async function getActiveTasksForPlanIds(userId: string, planIds: number[]) {
  if (planIds.length === 0) return [];

  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(inArray(tasks.planId, planIds), eq(plans.userId, userId), isNull(tasks.deletedAt)))
    .then((result) => result.map((row) => row.task));

  return [...rows].sort(compareTasksDefaultOrder);
}

export async function getAllActiveTasks(userId: string) {
  return db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(plans.userId, userId), isNull(tasks.deletedAt)))
    .then((rows) => rows.map((r) => r.task));
}

export async function getAllActiveTasksWithPlan(userId: string) {
  return db
    .select({ task: tasks, plan: plans })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(plans.userId, userId), isNull(tasks.deletedAt)));
}

export async function getTaskById(userId: string, taskId: number) {
  const [row] = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(tasks.id, taskId), eq(plans.userId, userId)));
  return row?.task ?? null;
}

export async function getWorkLogsForTaskIds(userId: string, taskIds: number[]) {
  if (taskIds.length === 0) return [];
  return db
    .select({ workLog: workLogs })
    .from(workLogs)
    .innerJoin(tasks, eq(workLogs.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(inArray(workLogs.taskId, taskIds), eq(plans.userId, userId)))
    .then((rows) => rows.map((r) => r.workLog));
}

export async function getWorkLogsForTask(userId: string, taskId: number) {
  return db
    .select({ workLog: workLogs })
    .from(workLogs)
    .innerJoin(tasks, eq(workLogs.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(workLogs.taskId, taskId), eq(plans.userId, userId)))
    .orderBy(desc(workLogs.startAt))
    .then((rows) => rows.map((r) => r.workLog));
}

export async function getAllWorkLogsWithContext(userId: string) {
  return db
    .select({
      workLog: workLogs,
      task: tasks,
      plan: plans,
    })
    .from(workLogs)
    .innerJoin(tasks, eq(workLogs.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(eq(plans.userId, userId))
    .orderBy(desc(workLogs.startAt));
}

export async function getReflectionsForPlan(userId: string, planId: number) {
  return db
    .select({ reflection: reflections })
    .from(reflections)
    .innerJoin(plans, eq(reflections.planId, plans.id))
    .where(and(eq(reflections.planId, planId), eq(plans.userId, userId)))
    .orderBy(desc(reflections.periodEnd))
    .then((rows) => rows.map((r) => r.reflection));
}

/** The plan this plan's reflection improvement was carried into (first match), for the "NEXT" bearing line. */
export async function getCarriedNextPlan(userId: string, planId: number): Promise<{ id: number; title: string } | null> {
  const [row] = await db
    .select({ id: plans.id, title: plans.title })
    .from(reflections)
    .innerJoin(plans, eq(reflections.carriedPlanId, plans.id))
    .where(and(eq(reflections.planId, planId), eq(plans.userId, userId)))
    .orderBy(desc(reflections.createdAt))
    .limit(1);
  return row ?? null;
}

/** Latest carried-to plan for each source plan, matching getCarriedNextPlan's ordering. */
export async function getCarriedNextPlans(userId: string, planIds: number[]) {
  if (planIds.length === 0) return new Map<number, { id: number; title: string }>();

  const rows = await db
    .select({ sourcePlanId: reflections.planId, id: plans.id, title: plans.title })
    .from(reflections)
    .innerJoin(plans, eq(reflections.carriedPlanId, plans.id))
    .where(and(inArray(reflections.planId, planIds), eq(plans.userId, userId)))
    .orderBy(desc(reflections.createdAt));

  const result = new Map<number, { id: number; title: string }>();
  for (const row of rows) {
    if (!result.has(row.sourcePlanId)) result.set(row.sourcePlanId, { id: row.id, title: row.title });
  }
  return result;
}

/**
 * First carried-plan id per source plan in periodEnd-desc order. This preserves
 * the plan-list behavior without loading every reflection body into memory.
 */
export async function getCarriedPlanIdsForPlans(userId: string, planIds: number[]) {
  if (planIds.length === 0) return new Map<number, number>();

  const rows = await db
    .select({
      sourcePlanId: reflections.planId,
      carriedPlanId: reflections.carriedPlanId,
    })
    .from(reflections)
    .innerJoin(plans, eq(reflections.planId, plans.id))
    .where(
      and(
        inArray(reflections.planId, planIds),
        eq(plans.userId, userId),
        sql`${reflections.carriedPlanId} is not null`,
      ),
    )
    .orderBy(desc(reflections.periodEnd));

  const result = new Map<number, number>();
  for (const row of rows) {
    if (row.carriedPlanId !== null && !result.has(row.sourcePlanId)) {
      result.set(row.sourcePlanId, row.carriedPlanId);
    }
  }
  return result;
}

export async function getAllReflections(userId: string) {
  return db
    .select({ reflection: reflections, plan: plans })
    .from(reflections)
    .innerJoin(plans, eq(reflections.planId, plans.id))
    .where(eq(plans.userId, userId))
    .orderBy(desc(reflections.createdAt));
}

export async function countCompletionEventsForTask(userId: string, taskId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(completionEvents)
    .innerJoin(tasks, eq(completionEvents.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(completionEvents.taskId, taskId), eq(plans.userId, userId)));
  return row?.count ?? 0;
}

export async function getCompletionEventsForTask(userId: string, taskId: number) {
  return db
    .select({ event: completionEvents })
    .from(completionEvents)
    .innerJoin(tasks, eq(completionEvents.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(completionEvents.taskId, taskId), eq(plans.userId, userId)))
    .orderBy(desc(completionEvents.completionCycle))
    .then((rows) => rows.map((r) => r.event));
}

/** Distinct tag values currently in use, for the tasks filter UI. */
export async function getDistinctTags(userId: string) {
  const rows = await db
    .selectDistinct({ tag: tasks.tag })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(plans.userId, userId), isNull(tasks.deletedAt), sql`${tasks.tag} <> ''`));
  return rows.map((r) => r.tag).sort((a, b) => a.localeCompare(b));
}
