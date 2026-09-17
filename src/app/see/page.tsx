import Link from "next/link";
import { computeRetroAggregation } from "@/lib/aggregations";
import { formatDateOnly, formatDateTimeSeoul, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import {
  getActivePlans,
  getCarriedNextPlan,
  getHomePlan,
  getPlanById,
  getReflectionsForPlan,
  getWorkLogsForTaskIds,
} from "@/lib/queries";
import { priorityLabels } from "@/lib/validation";
import { describeScope, encodeScope, getTasksForScope, type SeeScope } from "@/lib/see-scope";
import { StatCard } from "@/components/StatCard";
import { ReflectionForm } from "@/components/ReflectionForm";
import { inputClassName } from "@/components/FormField";
import { ConstellationCard } from "@/components/constellation/ConstellationCard";

export const dynamic = "force-dynamic";

export default async function SeePage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; rangeStart?: string; rangeEnd?: string }>;
}) {
  const sp = await searchParams;
  const today = seoulTodayDateString();
  const plans = await getActivePlans();

  let scope: SeeScope | null = null;
  if (sp.rangeStart && sp.rangeEnd) {
    scope = { type: "range", start: sp.rangeStart, end: sp.rangeEnd };
  } else if (sp.planId) {
    const planId = Number(sp.planId);
    if (Number.isInteger(planId) && planId > 0) scope = { type: "plan", planId };
  }
  if (!scope) {
    const homePlan = await getHomePlan(today);
    if (homePlan) scope = { type: "plan", planId: homePlan.id };
  }

  if (!scope || plans.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="label-coord text-xs text-ink-400">SEE / 02</h1>
        <h2 className="text-xl font-bold text-ink-900">돌아보기</h2>
        <div className="border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-ink-500">
          돌아보기를 계산하려면 먼저 계획이 필요합니다.{" "}
          <Link href="/plans/new" className="font-medium text-ink-900 underline">
            계획 만들기
          </Link>
        </div>
      </div>
    );
  }

  const scopedTasks = await getTasksForScope(scope);
  const logs = await getWorkLogsForTaskIds(scopedTasks.map((t) => t.id));
  const aggregation = computeRetroAggregation(scopedTasks, logs, today);

  const scopePlan = scope.type === "plan" ? await getPlanById(scope.planId) : null;
  const scopeParam = encodeURIComponent(encodeScope(scope));
  const reflectionPlanId = scopePlan?.id ?? plans[0]?.id;
  const [reflections, nextPlan] = await Promise.all([
    reflectionPlanId ? getReflectionsForPlan(reflectionPlanId) : Promise.resolve([]),
    scopePlan ? getCarriedNextPlan(scopePlan.id) : Promise.resolve(null),
  ]);
  const carried = reflections.find((r) => r.carriedPlanId);
  const isComplete = aggregation.plannedCount > 0 && aggregation.doneCount === aggregation.plannedCount;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="label-coord text-xs text-ink-400">SEE / OBSERVATION</h1>
        <h2 className="text-xl font-bold text-ink-900">돌아보기</h2>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="planId" className="text-xs font-medium text-ink-500">
            계획으로 보기
          </label>
          <select id="planId" name="planId" defaultValue={scope.type === "plan" ? scope.planId : ""} className={inputClassName}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <span className="label-coord pb-2 text-[10px] text-ink-400">OR</span>
        <div className="flex flex-col gap-1">
          <label htmlFor="rangeStart" className="text-xs font-medium text-ink-500">
            기간 시작 (마감일 기준)
          </label>
          <input
            id="rangeStart"
            name="rangeStart"
            type="date"
            defaultValue={scope.type === "range" ? scope.start : ""}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rangeEnd" className="text-xs font-medium text-ink-500">
            기간 종료
          </label>
          <input
            id="rangeEnd"
            name="rangeEnd"
            type="date"
            defaultValue={scope.type === "range" ? scope.end : ""}
            className={inputClassName}
          />
        </div>
        <button type="submit" className="inline-flex h-fit bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
          조회
        </button>
      </form>
      <p className="label-coord -mt-4 text-[10px] text-ink-400">
        현재 범위: {describeScope(scope, scopePlan?.title)} · 기간 입력 시 계획 선택보다 우선 적용
      </p>

      {scope.type === "plan" && scopePlan && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
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

      <section aria-labelledby="agg-heading" className="flex flex-col gap-3">
        <h2 id="agg-heading" className="label-coord text-[10px] text-ink-400">
          집계 · 카드를 누르면 근거 기록으로 이동합니다
        </h2>
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=planned`} label="계획된 할 일" value={`${aggregation.plannedCount}건`} />
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=done`} label="완료" value={`${aggregation.doneCount}건`} />
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=overdue`} label="지연" value={`${aggregation.overdueCount}건`} />
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=blocked`} label="막힘" value={`${aggregation.blockedCount}건`} />
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=estimated`} label="예상 시간" value={minutesToLabel(aggregation.estimatedMinutesTotal)} />
          <StatCard href={`/see/evidence?scope=${scopeParam}&metric=actual`} label="실제 시간" value={minutesToLabel(aggregation.actualMinutesTotal)} />
        </div>
        <div className="flex items-center justify-between border border-line bg-surface-muted px-4 py-3 text-sm">
          <span className="label-coord text-[10px] text-ink-400">차이 (실제 − 예상)</span>
          <span className="font-mono font-semibold text-ink-900">
            {aggregation.diffMinutes > 0 ? "+" : ""}
            {minutesToLabel(aggregation.diffMinutes)}
          </span>
        </div>
      </section>

      {carried && carried.carriedPlanId && (
        <div className="flex items-center gap-3 border-t border-dashed border-line-strong pt-4 text-xs text-ink-500">
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

      <ReflectionForm
        plans={plans}
        defaultPlanId={reflectionPlanId}
        defaultPeriodStart={scope.type === "range" ? scope.start : scopePlan?.startDate}
        defaultPeriodEnd={scope.type === "range" ? scope.end : scopePlan?.endDate}
      />

      <section aria-labelledby="reflections-heading" className="flex flex-col gap-3">
        <h2 id="reflections-heading" className="label-coord text-[10px] text-ink-400">
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
  );
}
