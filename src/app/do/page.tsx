import Link from "next/link";
import { getAllActiveTasksWithPlan, getAllWorkLogsWithContext } from "@/lib/queries";
import { formatDateTimeSeoul, isOverdue, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { WorkLogForm } from "@/components/WorkLogForm";
import { CompletionControls } from "@/components/CompletionControls";
import { TaskStatusBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function DoPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const { taskId } = await searchParams;
  const [activeTasks, logs] = await Promise.all([getAllActiveTasksWithPlan(), getAllWorkLogsWithContext()]);
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

  // Group by the Seoul calendar date of startAt; logs arrive newest-first from the query.
  const logsByDate = new Map<string, typeof logs>();
  for (const row of logs) {
    const day = formatDateTimeSeoul(row.workLog.startAt).slice(0, 10);
    const bucket = logsByDate.get(day) ?? [];
    bucket.push(row);
    logsByDate.set(day, bucket);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="label-coord text-xs text-ink-400">DO / ACTUAL TRACE</h1>
        <h2 className="text-xl font-bold text-ink-900">실행 기록</h2>
      </div>

      {activeTasks.length === 0 ? (
        <div className="border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-500">
          실행 기록을 남기려면 먼저 할 일이 필요합니다.{" "}
          <Link href="/tasks/new" className="font-medium text-ink-900 underline">
            할 일 추가
          </Link>
        </div>
      ) : (
        <WorkLogForm tasksByPlan={tasksByPlan} defaultTaskId={highlightTaskId} />
      )}

      <section aria-labelledby="active-tasks-heading" className="flex flex-col gap-3">
        <h2 id="active-tasks-heading" className="label-coord text-[10px] text-ink-400">
          진행 중인 할 일 완료 처리
        </h2>
        {activeTasks.length === 0 ? (
          <p className="text-sm text-ink-400">진행 중인 할 일이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
            {activeTasks.map(({ task, plan }) => (
              <li
                key={task.id}
                className={`flex flex-wrap items-center justify-between gap-2 p-4 ${
                  highlightTaskId === task.id ? "bg-surface-muted" : ""
                }`}
              >
                <div>
                  <div className="mb-1">
                    <TaskStatusBadge status={task.status} overdue={isOverdue(task.dueDate, task.status, today)} />
                  </div>
                  <Link href={`/tasks/${task.id}`} className="font-medium text-ink-900 hover:underline">
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
        <h2 id="worklog-list-heading" className="label-coord text-[10px] text-ink-400">
          전체 실행 기록 ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">아직 실행 기록이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {[...logsByDate.entries()].map(([day, rows]) => {
              const dayTotal = rows.reduce((sum, r) => sum + r.workLog.actualMinutes, 0);
              return (
                <section key={day} aria-label={`${day} 실행 기록`}>
                  {/* date rule -- the "tick" on the log's vertical axis */}
                  <div className="mb-3 flex items-baseline gap-3 border-b border-ink-900 pb-1">
                    <span className="font-mono text-sm font-semibold text-ink-900">{day}</span>
                    <span className="label-coord text-[10px] text-ink-400">
                      {rows.length} ENTRIES · {minutesToLabel(dayTotal)}
                    </span>
                  </div>
                  <ul className="flex flex-col border-l border-line-strong pl-4">
                    {rows.map(({ workLog, task, plan }) => (
                      <li key={workLog.id} className="relative border-b border-line py-4 last:border-b-0">
                        <span
                          aria-hidden="true"
                          className="absolute -left-[20.5px] top-[1.35rem] h-2 w-2 rounded-full border border-ink-900 bg-surface"
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="font-mono text-xs text-ink-900">
                            {formatDateTimeSeoul(workLog.startAt).slice(11)} – {formatDateTimeSeoul(workLog.endAt).slice(11)}
                          </span>
                          <span className="font-mono text-sm font-semibold text-ink-900">
                            {minutesToLabel(workLog.actualMinutes)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm text-ink-700">
                          <Link href={`/plans/${plan.id}`} className="text-ink-500 underline underline-offset-2">
                            {plan.title}
                          </Link>{" "}
                          ›{" "}
                          <Link href={`/tasks/${task.id}`} className="font-medium underline underline-offset-2">
                            {task.title}
                          </Link>
                        </p>
                        {workLog.blockerReason && (
                          <p className="mt-1 border-l-2 border-dashed border-ink-500 pl-2 text-sm text-ink-700">
                            <span className="label-coord mr-1 text-[9px] text-ink-400">BLOCKED</span>
                            {workLog.blockerReason}
                          </p>
                        )}
                        <p className="mt-1 font-mono text-[11px] text-ink-400">
                          기록일 {formatDateTimeSeoul(workLog.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
