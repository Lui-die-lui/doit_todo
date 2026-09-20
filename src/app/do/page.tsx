import { getAllActiveTasksWithPlan, getAllWorkLogsWithContext } from "@/lib/queries";
import { seoulTodayDateString } from "@/lib/date";
import { WorkLogForm } from "@/components/WorkLogForm";
import { WorkLogFilterList } from "@/components/do/WorkLogFilterList";
import { ActiveTaskFilterList } from "@/components/do/ActiveTaskFilterList";
import { PageHeader } from "@/components/PageHeader";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DoPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const session = await requireSessionOrRedirect();
  const { taskId } = await searchParams;
  const [activeTasks, logs] = await Promise.all([
    getAllActiveTasksWithPlan(session.user.id),
    getAllWorkLogsWithContext(session.user.id),
  ]);
  const today = seoulTodayDateString();

  const groupedByPlan = new Map<string, { id: number; title: string }[]>();
  for (const { task, plan } of activeTasks) {
    const arr = groupedByPlan.get(plan.title) ?? [];
    arr.push({ id: task.id, title: task.title });
    groupedByPlan.set(plan.title, arr);
  }
  const tasksByPlan = [...groupedByPlan.entries()].map(([planTitle, tasksList]) => ({
    planTitle,
    tasks: tasksList,
  }));

  const highlightTaskId = taskId ? Number(taskId) : undefined;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="DO / ACTUAL TRACE" title="실행 기록" description="계획을 실제 행동과 시간 기록으로 연결합니다." />

      {activeTasks.length > 0 && (
        <div className="border border-line bg-surface p-6 sm:p-8">
          <WorkLogForm tasksByPlan={tasksByPlan} defaultTaskId={highlightTaskId} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="active-tasks-heading" className="flex flex-col gap-3">
          <h2 id="active-tasks-heading" className="label-coord text-[11px] text-ink-400">
            진행 중인 할 일
          </h2>
          <ActiveTaskFilterList tasks={activeTasks} today={today} highlightTaskId={highlightTaskId} />
        </section>

        <section aria-labelledby="worklog-list-heading" className="flex flex-col gap-3">
          <h2 id="worklog-list-heading" className="label-coord text-[11px] text-ink-400">
            실행 기록 ({logs.length})
          </h2>
          <WorkLogFilterList logs={logs} today={today} />
        </section>
      </div>
    </div>
  );
}
