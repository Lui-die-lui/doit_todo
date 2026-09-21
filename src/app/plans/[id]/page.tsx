import Link from "next/link";
import { notFound } from "next/navigation";
import { archivePlanAction } from "@/lib/actions/plans";
import {
  getActiveTasksForPlan,
  getCarriedNextPlan,
  getPlanById,
  getReflectionsForPlan,
  getWorkLogsForTaskIds,
} from "@/lib/queries";
import { computeRetroAggregation } from "@/lib/aggregations";
import { encodeScope } from "@/lib/see-scope";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { formatDateOnly, formatDateTimeSeoul, isOverdue, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ConstellationCard } from "@/components/constellation/ConstellationCard";
import { AggregationCards } from "@/components/see/AggregationCards";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect();
  const userId = session.user.id;
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const plan = await getPlanById(userId, planId);
  if (!plan) notFound();

  const [tasks, reflections, nextPlan] = await Promise.all([
    getActiveTasksForPlan(userId, planId),
    getReflectionsForPlan(userId, planId),
    getCarriedNextPlan(userId, planId),
  ]);
  const workLogs = await getWorkLogsForTaskIds(userId, tasks.map((t) => t.id));
  const today = seoulTodayDateString();
  // Same numbers /see shows for this plan: same active-task scope, same aggregation function.
  const aggregation = computeRetroAggregation(tasks, workLogs, today);
  const scopeParam = encodeURIComponent(encodeScope({ type: "plan", planId: plan.id }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={plan.priority} />
            <span className="font-mono text-xs text-ink-400">
              {formatDateOnly(plan.startDate)} – {formatDateOnly(plan.endDate)}
            </span>
            {plan.deletedAt && (
              <span className="label-coord border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-400">
                ARCHIVED
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ink-900">{plan.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/plans/${plan.id}/edit`}
            className="inline-flex rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-700 hover:border-ink-900 hover:text-ink-900"
          >
            수정
          </Link>
          <Link
            href={`/plans/${plan.id}/history`}
            className="inline-flex rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-700 hover:border-ink-900 hover:text-ink-900"
          >
            수정 이력
          </Link>
          {!plan.deletedAt && (
            <form action={archivePlanAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <ConfirmSubmitButton confirmMessage="이 계획을 보관(삭제) 처리할까요? 목록에서 숨겨집니다.">
                보관
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>

      {plan.description && <p className="whitespace-pre-wrap text-sm text-ink-500">{plan.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <div className="border border-line bg-surface p-4">
            <h2 className="label-coord mb-1 text-[10px] text-ink-400">성공 기준</h2>
            <p className="whitespace-pre-wrap text-sm text-ink-900">{plan.successCriteria}</p>
          </div>
          <div className="border border-line bg-surface p-4">
            <h2 className="label-coord mb-1 text-[10px] text-ink-400">예상 총 투입 시간</h2>
            <p className="font-mono text-sm text-ink-900">{minutesToLabel(plan.estimatedMinutes)}</p>
          </div>

          {plan.carriedImprovement && (
            <div className="border border-line-strong bg-surface-muted p-4">
              <h2 className="label-coord mb-1 text-[10px] text-ink-500">이어받은 개선점</h2>
              <p className="whitespace-pre-wrap text-sm text-ink-900">{plan.carriedImprovement}</p>
              {plan.sourceReflectionId && (
                <p className="mt-1 text-xs text-ink-400">돌아보기 #{plan.sourceReflectionId}에서 이어짐</p>
              )}
            </div>
          )}

          <section aria-labelledby="plan-retro-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="plan-retro-heading" className="label-coord text-[10px] text-ink-400">
                돌아보기 · 집계
              </h2>
              <Link href={`/see?planId=${plan.id}`} className="text-xs font-medium text-ink-900 hover:underline">
                돌아보기 화면 →
              </Link>
            </div>
            <AggregationCards scopeParam={scopeParam} aggregation={aggregation} compact />
          </section>
        </div>

        <div className="order-1 lg:order-2">
          <ConstellationCard
            coord="PLAN / DETAIL"
            planTitle={plan.title}
            planStartDate={plan.startDate}
            planEndDate={plan.endDate}
            planEstimatedMinutes={plan.estimatedMinutes}
            tasks={tasks}
            workLogs={workLogs}
            nextPlan={nextPlan}
          />
        </div>
      </div>

      <section aria-labelledby="tasks-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="tasks-heading" className="label-coord text-[10px] text-ink-400">
            할 일 목록 ({tasks.length})
          </h2>
          <Link href={`/tasks/new?planId=${plan.id}`} className="text-sm font-medium text-ink-900 hover:underline">
            + 할 일 추가
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div className="border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-400">
            아직 이 계획에 속한 할 일이 없습니다.
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="font-medium text-ink-900">{task.title}</span>
                  <span className="flex items-center gap-2">
                    <TaskStatusBadge status={task.status} overdue={isOverdue(task.dueDate, task.status, today)} />
                    <span className="font-mono text-xs text-ink-400">{formatDateOnly(task.dueDate)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reflections-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="reflections-heading" className="label-coord text-[10px] text-ink-400">
            돌아보기 ({reflections.length})
          </h2>
          <Link href={`/see?planId=${plan.id}`} className="text-sm font-medium text-ink-900 hover:underline">
            돌아보기 화면으로 →
          </Link>
        </div>
        {reflections.length === 0 ? (
          <p className="text-sm text-ink-400">아직 작성된 돌아보기가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reflections.map((r) => (
              <li key={r.id} className="border border-line bg-surface p-4 text-sm">
                <div className="mb-1 font-mono text-xs text-ink-400">
                  {formatDateOnly(r.periodStart)} – {formatDateOnly(r.periodEnd)} · {formatDateTimeSeoul(r.createdAt)}
                </div>
                <p className="text-ink-700">{r.summary}</p>
                <p className="mt-1 text-ink-500">
                  <strong className="text-ink-900">개선점:</strong> {r.improvement}
                  {r.carriedPlanId && (
                    <>
                      {" "}
                      →{" "}
                      <Link href={`/plans/${r.carriedPlanId}`} className="underline">
                        계획 #{r.carriedPlanId}로 이어짐
                      </Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
