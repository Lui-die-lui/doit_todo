import Link from "next/link";
import { computeRetroAggregation } from "@/lib/aggregations";
import { buildConstellationTasks, computeConstellationLayout, getOrbitBoundaryDates } from "@/lib/constellation";
import { isOverdue, seoulTodayDateString } from "@/lib/date";
import { getActivePlans, getActiveTasksForPlan, getCarriedNextPlan, getHomePlan, getWorkLogsForTaskIds } from "@/lib/queries";
import { HomeCarousel, type HomeSlide } from "@/components/observatory/HomeCarousel";
import type { HomeTaskRow } from "@/components/observatory/HomeTaskList";
import type { Plan } from "@/db/schema";

export const dynamic = "force-dynamic";

async function buildHomeSlide(plan: Plan, today: string): Promise<HomeSlide> {
  const tasks = await getActiveTasksForPlan(plan.id);
  const [workLogs, nextPlan] = await Promise.all([
    getWorkLogsForTaskIds(tasks.map((t) => t.id)),
    getCarriedNextPlan(plan.id),
  ]);

  const aggregation = computeRetroAggregation(tasks, workLogs, today);
  const constellationTasks = buildConstellationTasks(tasks, workLogs);
  const layout = computeConstellationLayout(constellationTasks, plan.startDate, plan.endDate, today);
  const orbitDateLabels = getOrbitBoundaryDates(plan.startDate, plan.endDate);

  const actualByTask = new Map(constellationTasks.map((t) => [t.id, t.actualMinutesTotal]));
  const taskRows: HomeTaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    tag: t.tag,
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    actualMinutes: actualByTask.get(t.id) ?? 0,
    createdAt: new Date(t.createdAt).toISOString(),
    isOverdue: isOverdue(t.dueDate, t.status, today),
  }));

  const taskTitleById = new Map(tasks.map((t) => [t.id, t.title]));
  const recentLogs = [...workLogs]
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    .slice(0, 5)
    .map((log) => ({
      id: log.id,
      taskId: log.taskId,
      taskTitle: taskTitleById.get(log.taskId) ?? `할 일 #${log.taskId}`,
      startAt: new Date(log.startAt).toISOString(),
      endAt: new Date(log.endAt).toISOString(),
      actualMinutes: log.actualMinutes,
      blockerReason: log.blockerReason,
    }));

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      startDate: plan.startDate,
      endDate: plan.endDate,
      priority: plan.priority,
      successCriteria: plan.successCriteria,
      estimatedMinutes: plan.estimatedMinutes,
    },
    layout,
    orbitDateLabels,
    stats: {
      planned: aggregation.plannedCount,
      done: aggregation.doneCount,
      overdue: aggregation.overdueCount,
      blocked: aggregation.blockedCount,
      actualMinutes: aggregation.actualMinutesTotal,
    },
    nextPlan,
    taskRows,
    recentLogs,
    estimatedMinutesTotal: aggregation.estimatedMinutesTotal,
    actualMinutesTotal: aggregation.actualMinutesTotal,
    diffMinutes: aggregation.diffMinutes,
  };
}

export default async function HomePage() {
  const today = seoulTodayDateString();
  const [plans, homePlan] = await Promise.all([getActivePlans(), getHomePlan(today)]);

  if (plans.length === 0 || !homePlan) {
    return (
      <section className="flex min-h-[calc(100svh-12rem)] flex-col items-center justify-center gap-4 text-center">
        <p className="label-coord text-[10px] text-ink-400">PUBLIC OBSERVATORY · NO CONSTELLATION YET</p>
        <h1 className="text-2xl font-bold text-ink-900">첫 계획을 만들면 이 자리에 별자리가 그려집니다</h1>
        <Link href="/plans/new" className="inline-flex rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85">
          첫 계획 만들기
        </Link>
      </section>
    );
  }

  const slides = await Promise.all(plans.map((plan) => buildHomeSlide(plan, today)));
  const initialIndex = Math.max(0, plans.findIndex((p) => p.id === homePlan.id));

  return <HomeCarousel slides={slides} initialIndex={initialIndex} />;
}
