import Link from "next/link";
import { computeRetroAggregation } from "@/lib/aggregations";
import { formatDateOnly, formatDateTimeSeoul, seoulTodayDateString } from "@/lib/date";
import {
  getActivePlans,
  getCarriedNextPlan,
  getPlanById,
  getReflectionsForPlan,
  getWorkLogsForTaskIds,
  pickHomePlan,
} from "@/lib/queries";
import { priorityLabels } from "@/lib/validation";
import { describeScope, encodeScope, getTasksForScope, type SeeScope } from "@/lib/see-scope";
import { ReflectionForm } from "@/components/ReflectionForm";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { ConstellationCard } from "@/components/constellation/ConstellationCard";
import { PageHeader } from "@/components/PageHeader";
import { AggregationCards } from "@/components/see/AggregationCards";
import { SeeFlowSteps } from "@/components/see/SeeFlowSteps";
import { PlaceholderMetrics } from "@/components/see/PlaceholderMetrics";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SeePage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; rangeStart?: string; rangeEnd?: string }>;
}) {
  const session = await requireSessionOrRedirect();
  const userId = session.user.id;
  const sp = await searchParams;
  const today = seoulTodayDateString();
  const plans = await getActivePlans(userId);

  let scope: SeeScope | null = null;
  if (sp.rangeStart && sp.rangeEnd) {
    scope = { type: "range", start: sp.rangeStart, end: sp.rangeEnd };
  } else if (sp.planId) {
    const planId = Number(sp.planId);
    if (Number.isInteger(planId) && planId > 0) scope = { type: "plan", planId };
  }
  if (!scope) {
    const homePlan = pickHomePlan(plans, today);
    if (homePlan) scope = { type: "plan", planId: homePlan.id };
  }

  if (!scope || plans.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <PageHeader eyebrow="SEE / OBSERVATION" title="돌아보기" description="계획과 실행의 차이를 확인하고 다음 궤도를 조정합니다." />

        <div className="flex min-h-[360px] flex-col gap-8 border border-line bg-surface p-8 sm:p-10">
          <SeeFlowSteps />

          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">비교할 계획과 실행 기록이 아직 없습니다.</h2>
            <p className="max-w-md text-sm text-ink-500 sm:text-base">
              계획을 만들고 실행을 기록하면 예상 시간과 실제 시간의 차이를 확인할 수 있어요.
            </p>
            <Link
              href="/plans/new"
              className="inline-flex min-h-[42px] items-center justify-center rounded-sm bg-ink-900 px-6 text-sm font-medium text-white hover:opacity-85"
            >
              첫 계획 만들기
            </Link>
          </div>

          <PlaceholderMetrics />
        </div>
      </div>
    );
  }

  const scopedTasks = await getTasksForScope(userId, scope);
  const logs = await getWorkLogsForTaskIds(userId, scopedTasks.map((t) => t.id));
  const aggregation = computeRetroAggregation(scopedTasks, logs, today);

  const scopePlan = scope.type === "plan" ? await getPlanById(userId, scope.planId) : null;
  const scopeParam = encodeURIComponent(encodeScope(scope));
  const reflectionPlanId = scopePlan?.id ?? plans[0]?.id;
  const [reflections, nextPlan] = await Promise.all([
    reflectionPlanId ? getReflectionsForPlan(userId, reflectionPlanId) : Promise.resolve([]),
    scopePlan ? getCarriedNextPlan(userId, scopePlan.id) : Promise.resolve(null),
  ]);
  const carried = reflections.find((r) => r.carriedPlanId);
  const isComplete = aggregation.plannedCount > 0 && aggregation.doneCount === aggregation.plannedCount;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="SEE / OBSERVATION" title="돌아보기" description="계획과 실행의 차이를 확인하고 다음 궤도를 조정합니다." />

      <form
        method="get"
        className="flex flex-col gap-3 border border-line bg-surface p-5 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="planId" className="text-sm font-medium text-ink-500">
            계획으로 보기
          </label>
          <Select
            id="planId"
            name="planId"
            size="lg"
            defaultValue={String(
              scope.type === "plan" && plans.some((p) => p.id === scope.planId) ? scope.planId : plans[0].id,
            )}
            options={plans.map((p) => ({ value: String(p.id), label: p.title }))}
          />
        </div>
        <span className="label-coord pb-2 text-[10px] text-ink-400">OR</span>
        <div className="flex flex-col gap-1">
          <label htmlFor="rangeStart" className="text-sm font-medium text-ink-500">
            기간 시작 (마감일 기준)
          </label>
          <DateTimePicker
            id="rangeStart"
            name="rangeStart"
            dateOnly
            className="sm:w-[200px]"
            defaultValue={scope.type === "range" ? scope.start : ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rangeEnd" className="text-sm font-medium text-ink-500">
            기간 종료
          </label>
          <DateTimePicker
            id="rangeEnd"
            name="rangeEnd"
            dateOnly
            className="sm:w-[200px]"
            defaultValue={scope.type === "range" ? scope.end : ""}
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-[42px] items-center rounded-sm bg-ink-900 px-6 text-sm font-medium text-white hover:opacity-90"
        >
          조회
        </button>
      </form>
      <p className="label-coord -mt-6 text-[10px] text-ink-400">
        현재 범위: {describeScope(scope, scopePlan?.title)} · 기간 입력 시 계획 선택보다 우선 적용
      </p>

      {scope.type === "plan" && scopePlan && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] lg:items-start lg:gap-10">
          <div className="flex flex-col gap-6">
            <dl className="flex flex-col gap-4 border border-line bg-surface p-5">
              <div>
                <dt className="label-coord text-[10px] text-ink-400">STATUS · 현재 상태</dt>
                <dd className="text-sm font-medium text-ink-900">
                  {isComplete
                    ? "CONSTELLATION COMPLETE — 모든 할 일 완료"
                    : `진행 중 · ${aggregation.doneCount} / ${aggregation.plannedCount} 완료`}
                </dd>
              </div>
              <div>
                <dt className="label-coord text-[10px] text-ink-400">PERIOD · PRIORITY</dt>
                <dd className="font-mono text-sm text-ink-900">
                  {formatDateOnly(scopePlan.startDate)} – {formatDateOnly(scopePlan.endDate)} · {priorityLabels[scopePlan.priority]}
                </dd>
              </div>
              <div>
                <dt className="label-coord text-[10px] text-ink-400">SUCCESS CRITERIA · 성공 기준</dt>
                <dd className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">{scopePlan.successCriteria}</dd>
              </div>
            </dl>

            {/* Aggregation, embedded here on desktop -- fills the space the summary card
                leaves empty next to the taller constellation card. The standalone full-width
                version below (`agg-heading`) covers mobile/tablet, where this column isn't
                beside anything taller. */}
            <section aria-labelledby="agg-heading-desktop" className="hidden flex-col gap-3 lg:flex">
              <h2 id="agg-heading-desktop" className="label-coord text-[11px] text-ink-400">
                집계 · 카드를 누르면 근거 기록으로 이동합니다
              </h2>
              <AggregationCards scopeParam={scopeParam} aggregation={aggregation} compact />
            </section>
          </div>

          <ConstellationCard
            coord="SEE / SELECTED PLAN"
            planTitle={scopePlan.title}
            planStartDate={scopePlan.startDate}
            planEndDate={scopePlan.endDate}
            planEstimatedMinutes={scopePlan.estimatedMinutes}
            tasks={scopedTasks}
            workLogs={logs}
            nextPlan={nextPlan}
          />
        </div>
      )}

      <section
        aria-labelledby="agg-heading"
        className={`flex flex-col gap-3 ${scope.type === "plan" && scopePlan ? "lg:hidden" : ""}`}
      >
        <h2 id="agg-heading" className="label-coord text-[11px] text-ink-400">
          집계 · 카드를 누르면 근거 기록으로 이동합니다
        </h2>
        <AggregationCards scopeParam={scopeParam} aggregation={aggregation} />
      </section>

      {carried && carried.carriedPlanId && (
        <div className="flex items-center gap-3 border-t border-dashed border-line-strong pt-4 text-sm text-ink-500">
          <span aria-hidden="true" className="text-ink-400">
            ┄┄┄▸
          </span>
          이 계획의 개선점이{" "}
          <Link href={`/plans/${carried.carriedPlanId}`} className="font-medium text-ink-900 underline">
            다음 별자리(계획 #{carried.carriedPlanId})
          </Link>
          로 이어졌습니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <ReflectionForm
          plans={plans}
          defaultPlanId={reflectionPlanId}
          defaultPeriodStart={scope.type === "range" ? scope.start : scopePlan?.startDate}
          defaultPeriodEnd={scope.type === "range" ? scope.end : scopePlan?.endDate}
        />

        <section aria-labelledby="reflections-heading" className="flex flex-col gap-3">
          <h2 id="reflections-heading" className="label-coord text-[11px] text-ink-400">
            이 계획의 돌아보기 기록 ({reflections.length})
          </h2>
          {reflections.length === 0 ? (
            <p className="text-sm text-ink-400">아직 작성된 돌아보기가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reflections.map((r) => (
                <li key={r.id} id={`reflection-${r.id}`} className="border border-line bg-surface p-4 text-sm">
                  <div className="mb-1 font-mono text-xs text-ink-400">
                    {formatDateOnly(r.periodStart)} – {formatDateOnly(r.periodEnd)} · 작성 {formatDateTimeSeoul(r.createdAt)}
                  </div>
                  <p className="text-ink-700">{r.summary}</p>
                  <p className="mt-1 text-ink-500">
                    <strong className="text-ink-900">고칠 점:</strong> {r.improvement}
                  </p>
                  <div className="mt-2">
                    {r.carriedPlanId ? (
                      <Link href={`/plans/${r.carriedPlanId}`} className="text-xs font-medium text-ink-900 underline">
                        계획 #{r.carriedPlanId}로 이어짐 →
                      </Link>
                    ) : (
                      <Link
                        href={`/plans/new?improvement=${encodeURIComponent(r.improvement)}&reflectionId=${r.id}`}
                        className="text-xs font-medium text-ink-900 underline"
                      >
                        이 개선점을 다음 계획으로 넘기기 →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
