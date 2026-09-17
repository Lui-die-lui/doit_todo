import Link from "next/link";
import { computeRetroAggregation } from "@/lib/aggregations";
import { formatDateOnly, formatDateTimeSeoul, isOverdue, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { getAllPlans, getPlanById, getWorkLogsForTaskIds } from "@/lib/queries";
import { describeScope, parseScope, getTasksForScope } from "@/lib/see-scope";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

const METRIC_LABELS: Record<string, string> = {
  planned: "계획된 할 일",
  done: "완료된 할 일",
  overdue: "지연된 할 일",
  blocked: "막힘이 있었던 할 일",
  estimated: "예상 시간에 포함된 할 일",
  actual: "실제 시간에 포함된 실행 기록",
};

export default async function SeeEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; metric?: string }>;
}) {
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const metric = sp.metric && sp.metric in METRIC_LABELS ? sp.metric : null;

  if (!scope || !metric) {
    return (
      <div className="border border-line-strong bg-surface-muted p-8 text-center text-sm text-ink-700">
        잘못되었거나 만료된 근거 링크입니다.{" "}
        <Link href="/see" className="font-medium text-ink-900 underline">
          돌아보기로 돌아가기
        </Link>
      </div>
    );
  }

  const today = seoulTodayDateString();
  const scopedTasks = await getTasksForScope(scope);
  const logs = await getWorkLogsForTaskIds(scopedTasks.map((t) => t.id));
  const aggregation = computeRetroAggregation(scopedTasks, logs, today);

  const scopePlan = scope.type === "plan" ? await getPlanById(scope.planId) : null;
  const allPlans = await getAllPlans();
  const planTitleById = new Map(allPlans.map((p) => [p.id, p.title]));

  const taskById = new Map(scopedTasks.map((t) => [t.id, t]));

  let idSet: Set<number>;
  let total: string;
  switch (metric) {
    case "planned":
      idSet = new Set(aggregation.plannedTaskIds);
      total = `${aggregation.plannedCount}건`;
      break;
    case "done":
      idSet = new Set(aggregation.doneTaskIds);
      total = `${aggregation.doneCount}건`;
      break;
    case "overdue":
      idSet = new Set(aggregation.overdueTaskIds);
      total = `${aggregation.overdueCount}건`;
      break;
    case "blocked":
      idSet = new Set(aggregation.blockedTaskIds);
      total = `${aggregation.blockedCount}건 (고유 할 일 수)`;
      break;
    case "estimated":
      idSet = new Set(aggregation.plannedTaskIds);
      total = minutesToLabel(aggregation.estimatedMinutesTotal);
      break;
    default:
      idSet = new Set();
      total = minutesToLabel(aggregation.actualMinutesTotal);
  }

  const isWorkLogMetric = metric === "actual";
  const relevantLogs = isWorkLogMetric
    ? logs.filter((l) => aggregation.actualWorkLogIds.includes(l.id))
    : metric === "blocked"
      ? logs.filter((l) => idSet.has(l.taskId) && (l.blockerReason ?? "").trim().length > 0)
      : [];

  const relevantTasks = !isWorkLogMetric ? scopedTasks.filter((t) => idSet.has(t.id)) : [];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/see" className="label-coord text-[11px] text-ink-500 hover:text-ink-900">
        ← 돌아보기로
      </Link>
      <div>
        <h1 className="label-coord text-xs text-ink-400">SEE / EVIDENCE</h1>
        <h2 className="text-xl font-bold text-ink-900">{METRIC_LABELS[metric]}</h2>
      </div>
      <p className="text-sm text-ink-500">적용된 조건: {describeScope(scope, scopePlan?.title)}</p>
      <div className="flex items-center justify-between border border-line bg-surface-muted px-4 py-3 text-sm">
        <span className="label-coord text-[10px] text-ink-400">
          이 목록의 합계
          {metric === "estimated" && ` (할 일 ${relevantTasks.length}건)`}
          {isWorkLogMetric && ` (실행 기록 ${relevantLogs.length}건)`}
        </span>
        <span className="font-mono font-semibold text-ink-900">{total}</span>
      </div>

      {isWorkLogMetric ? (
        relevantLogs.length === 0 ? (
          <p className="text-sm text-ink-400">해당하는 실행 기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {relevantLogs.map((log) => {
              const task = taskById.get(log.taskId);
              return (
                <li key={log.id} className="border border-line bg-surface p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink-700">
                      {task ? (
                        <>
                          <Link href={`/plans/${task.planId}`} className="underline">
                            {planTitleById.get(task.planId) ?? `계획 #${task.planId}`}
                          </Link>{" "}
                          ›{" "}
                          <Link href={`/tasks/${task.id}`} className="underline">
                            {task.title}
                          </Link>
                        </>
                      ) : (
                        `할 일 #${log.taskId}`
                      )}
                    </span>
                    <span className="font-mono font-semibold text-ink-900">{minutesToLabel(log.actualMinutes)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-400">
                    {formatDateTimeSeoul(log.startAt)} ~ {formatDateTimeSeoul(log.endAt)}
                  </p>
                  {log.blockerReason && (
                    <p className="mt-1 text-ink-700">
                      <strong className="text-ink-900">막힌 이유:</strong> {log.blockerReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : relevantTasks.length === 0 ? (
        <p className="text-sm text-ink-400">해당하는 할 일이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {relevantTasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex flex-wrap items-center justify-between gap-2 border border-line bg-surface p-4 transition-colors hover:border-ink-900"
              >
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} overdue={isOverdue(task.dueDate, task.status, today)} />
                  </span>
                  <span className="font-medium text-ink-900">{task.title}</span>
                  <span className="text-xs text-ink-400">{planTitleById.get(task.planId) ?? `계획 #${task.planId}`}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 font-mono text-xs text-ink-400">
                  <span>마감 {formatDateOnly(task.dueDate)}</span>
                  <span>예상 {minutesToLabel(task.estimatedMinutes)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
