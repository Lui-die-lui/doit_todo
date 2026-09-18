import Link from "next/link";
import { notFound } from "next/navigation";
import { softDeleteTaskAction } from "@/lib/actions/tasks";
import { getPlanById, getTaskById, getWorkLogsForTask } from "@/lib/queries";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { formatDateOnly, formatDateTimeSeoul, isOverdue, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { CompletionControls } from "@/components/CompletionControls";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect();
  const userId = session.user.id;
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId <= 0) notFound();

  const task = await getTaskById(userId, taskId);
  if (!task || task.deletedAt) notFound();

  const [plan, logs] = await Promise.all([getPlanById(userId, task.planId), getWorkLogsForTask(userId, taskId)]);
  const today = seoulTodayDateString();
  const overdue = isOverdue(task.dueDate, task.status, today);
  const actualTotal = logs.reduce((sum, l) => sum + l.actualMinutes, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} overdue={overdue} />
            {task.tag && <span className="border border-line px-2 py-0.5 text-xs text-ink-500">#{task.tag}</span>}
          </div>
          <h1 className="text-2xl font-bold text-ink-900">{task.title}</h1>
          {plan && (
            <Link href={`/plans/${plan.id}`} className="text-sm text-ink-500 hover:text-ink-900 hover:underline">
              계획: {plan.title}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompletionControls taskId={task.id} status={task.status} />
          <Link
            href={`/tasks/${task.id}/edit`}
            className="inline-flex rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-700 hover:border-ink-900 hover:text-ink-900"
          >
            수정
          </Link>
          <form action={softDeleteTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <ConfirmSubmitButton confirmMessage="이 할 일을 삭제할까요? 목록과 집계에서 제외됩니다.">삭제</ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {task.description && <p className="whitespace-pre-wrap text-sm text-ink-500">{task.description}</p>}

      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
        <InfoBox label="마감일" value={formatDateOnly(task.dueDate)} />
        <InfoBox label="예상 시간" value={minutesToLabel(task.estimatedMinutes)} />
        <InfoBox label="실제 누적 시간" value={minutesToLabel(actualTotal)} />
        {task.completedAt && <InfoBox label="완료 시각" value={formatDateTimeSeoul(task.completedAt)} />}
      </div>

      <section aria-labelledby="worklogs-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="worklogs-heading" className="label-coord text-[10px] text-ink-400">
            실행 기록 ({logs.length})
          </h2>
          <Link href={`/do?taskId=${task.id}`} className="text-sm font-medium text-ink-900 hover:underline">
            + 실행 기록 추가
          </Link>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">아직 실행 기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => (
              <li key={log.id} className="border border-line bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-ink-700">
                    {formatDateTimeSeoul(log.startAt)} ~ {formatDateTimeSeoul(log.endAt)}
                  </span>
                  <span className="font-mono font-semibold text-ink-900">{minutesToLabel(log.actualMinutes)}</span>
                </div>
                {log.blockerReason && (
                  <p className="mt-1 text-ink-700">
                    <strong className="text-ink-900">막힌 이유:</strong> {log.blockerReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="label-coord text-[10px] text-ink-400">{label}</p>
      <p className="font-mono text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}
