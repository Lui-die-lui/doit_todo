import Link from "next/link";
import { computeRetroAggregation } from "@/lib/aggregations";
import { buildConstellationTasks, computeConstellationLayout, getOrbitBoundaryDates } from "@/lib/constellation";
import { isOverdue, seoulTodayDateString } from "@/lib/date";
import { getActivePlans, getActiveTasksForPlan, getCarriedNextPlan, getWorkLogsForTaskIds, pickHomePlan } from "@/lib/queries";
import { getSession } from "@/lib/session";
import {
  DemoConstellationBackdrop,
  DemoConstellationGate,
  GLASS_PANEL_CLASSNAME,
} from "@/components/observatory/DemoConstellationGate";
import { HomeCarousel, type HomeSlide } from "@/components/observatory/HomeCarousel";
import type { HomeTaskRow } from "@/components/observatory/HomeTaskList";
import type { Plan } from "@/db/schema";

export const dynamic = "force-dynamic";

async function buildHomeSlide(userId: string, plan: Plan, today: string): Promise<HomeSlide> {
  const [tasks, nextPlan] = await Promise.all([
    getActiveTasksForPlan(userId, plan.id),
    getCarriedNextPlan(userId, plan.id),
  ]);
  const workLogs = await getWorkLogsForTaskIds(userId, tasks.map((t) => t.id));

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

// Shown to a signed-in user with zero plans -- distinct from DemoConstellationGate
// (the signed-out state): this one is a real, if empty, authenticated screen.
// `/plans/new` still requires login, same as any other protected tab.
function EmptyConstellation() {
  return (
    <DemoConstellationBackdrop>
      <div className={GLASS_PANEL_CLASSNAME}>
        <p className="label-coord text-[10px] text-ink-400">OBSERVATORY · NO CONSTELLATION YET</p>
        <h1 className="text-xl font-bold leading-snug text-ink-900 sm:text-2xl">
          첫 계획을 만들면 이 자리에 별자리가 그려집니다
        </h1>
        <Link
          href="/plans/new"
          className="inline-flex items-center justify-center rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2"
        >
          첫 계획 만들기
        </Link>
      </div>
    </DemoConstellationBackdrop>
  );
}

export default async function DashboardPage() {
  // Deliberately not gated by requireSessionOrRedirect(): a signed-out visitor gets
  // DemoConstellationGate, a purely decorative screen with zero user-data queries,
  // instead of bouncing through the login screen first. No getActivePlans() or any
  // other owner-scoped query runs until a session actually exists. Every other
  // data-bearing route (/plans, /tasks, /do, /see) still hard-redirects when signed out.
  const session = await getSession();
  if (!session) {
    return <DemoConstellationGate />;
  }

  const userId = session.user.id;
  const today = seoulTodayDateString();
  const plans = await getActivePlans(userId);
  const homePlan = pickHomePlan(plans, today);

  if (plans.length === 0 || !homePlan) {
    return <EmptyConstellation />;
  }

  const slides = await Promise.all(plans.map((plan) => buildHomeSlide(userId, plan, today)));
  const initialIndex = Math.max(0, plans.findIndex((p) => p.id === homePlan.id));

  const viewerName = session.user.name || session.user.email.split("@")[0];
  return <HomeCarousel slides={slides} initialIndex={initialIndex} viewerName={viewerName} />;
}
