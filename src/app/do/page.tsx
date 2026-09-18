import Link from "next/link";
import { getAllActiveTasksWithPlan, getAllWorkLogsWithContext } from "@/lib/queries";
import { isOverdue, seoulTodayDateString } from "@/lib/date";
import { WorkLogForm } from "@/components/WorkLogForm";
import { WorkLogFilterList } from "@/components/do/WorkLogFilterList";
import { CompletionControls } from "@/components/CompletionControls";
import { TaskStatusBadge } from "@/components/Badges";
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
          {activeTasks.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 border border-dashed border-line-strong bg-surface p-8 text-center">
              <p className="text-base font-bold text-ink-900">지금 실행할 궤도가 없습니다.</p>
              <p className="max-w-xs text-sm text-ink-500">
                계획에서 할 일을 추가하면 여기에서 실행 시간을 기록할 수 있어요.
              </p>
              <Link
                href="/tasks/new"
                className="inline-flex min-h-[42px] items-center justify-center rounded-sm bg-ink-900 px-5 text-sm font-medium text-white hover:opacity-85"
              >
                할 일 추가
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
              {activeTasks.map(({ task, plan }) => (
                <li
                  key={task.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 ${
                    highlightTaskId === task.id ? "bg-surface-muted" : ""
                  }`}
                >
                  <div>
                    <div className="mb-1">
                      <TaskStatusBadge status={task.status} overdue={isOverdue(task.dueDate, task.status, today)} />
                    </div>
                    <Link href={`/tasks/${task.id}`} className="text-[15px] font-medium text-ink-900 hover:underline">
                      {task.title}
                    </Link>
                    <p className="text-xs text-ink-400">{plan.title}</p>
                  </div>
                  <CompletionControls taskId={task.id} status={task.status} />
                </li>
              ))}
            </ul>
          )}
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
