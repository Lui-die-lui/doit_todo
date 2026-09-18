import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { completionEvents, planRevisions, plans, reflections, tasks, workLogs } from "@/db/schema";
import { compareTasksDefaultOrder } from "./tasks-sort";

export async function getActivePlans() {
  return db
    .select()
    .from(plans)
    .where(isNull(plans.deletedAt))
    .orderBy(desc(plans.startDate), asc(plans.id));
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
export async function getHomePlan(todaySeoul: string) {
  const active = await getActivePlans();
  return pickHomePlan(active, todaySeoul);
}

export async function getAllPlans() {
  return db.select().from(plans).orderBy(desc(plans.createdAt), asc(plans.id));
}

export async function getPlanById(planId: number) {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  return plan ?? null;
}

export async function getPlanRevisions(planId: number) {
  return db
    .select()
    .from(planRevisions)
    .where(eq(planRevisions.planId, planId))
    .orderBy(desc(planRevisions.version));
}

export async function getActiveTasksForPlan(planId: number) {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.planId, planId), isNull(tasks.deletedAt)));
  return [...rows].sort(compareTasksDefaultOrder);
}

export async function getAllActiveTasks() {
  return db.select().from(tasks).where(isNull(tasks.deletedAt));
}

export async function getAllActiveTasksWithPlan() {
  return db
    .select({ task: tasks, plan: plans })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(isNull(tasks.deletedAt));
}

export async function getTaskById(taskId: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return task ?? null;
}

export async function getWorkLogsForTaskIds(taskIds: number[]) {
  if (taskIds.length === 0) return [];
  return db.select().from(workLogs).where(inArray(workLogs.taskId, taskIds));
}

export async function getWorkLogsForTask(taskId: number) {
  return db
    .select()
    .from(workLogs)
    .where(eq(workLogs.taskId, taskId))
    .orderBy(desc(workLogs.startAt));
}

export async function getAllWorkLogsWithContext() {
  return db
    .select({
      workLog: workLogs,
      task: tasks,
      plan: plans,
    })
    .from(workLogs)
    .innerJoin(tasks, eq(workLogs.taskId, tasks.id))
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .orderBy(desc(workLogs.startAt));
}

export async function getReflectionsForPlan(planId: number) {
  return db
    .select()
    .from(reflections)
    .where(eq(reflections.planId, planId))
    .orderBy(desc(reflections.periodEnd));
}

/** The plan this plan's reflection improvement was carried into (first match), for the "NEXT" bearing line. */
export async function getCarriedNextPlan(planId: number): Promise<{ id: number; title: string } | null> {
  const [row] = await db
    .select({ id: plans.id, title: plans.title })
    .from(reflections)
    .innerJoin(plans, eq(reflections.carriedPlanId, plans.id))
    .where(eq(reflections.planId, planId))
    .orderBy(desc(reflections.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getAllReflections() {
  return db
    .select({ reflection: reflections, plan: plans })
    .from(reflections)
    .innerJoin(plans, eq(reflections.planId, plans.id))
    .orderBy(desc(reflections.createdAt));
}

export async function countCompletionEventsForTask(taskId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(completionEvents)
    .where(eq(completionEvents.taskId, taskId));
  return row?.count ?? 0;
}

export async function getCompletionEventsForTask(taskId: number) {
  return db
    .select()
    .from(completionEvents)
    .where(eq(completionEvents.taskId, taskId))
    .orderBy(desc(completionEvents.completionCycle));
}

/** Distinct tag values currently in use, for the tasks filter UI. */
export async function getDistinctTags() {
  const rows = await db
    .selectDistinct({ tag: tasks.tag })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), sql`${tasks.tag} <> ''`));
  return rows.map((r) => r.tag).sort((a, b) => a.localeCompare(b));
}
