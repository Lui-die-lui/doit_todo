import Link from "next/link";
import {
  getActiveTasksForPlan,
  getAllPlans,
  getPlanRevisions,
  getReflectionsForPlan,
  getWorkLogsForTaskIds,
} from "@/lib/queries";
import { buildConstellationTasks, computeConstellationLayout } from "@/lib/constellation";
import { MiniConstellation } from "@/components/constellation/MiniConstellation";
import { PriorityBadge } from "@/components/Badges";
import { PlanExportImport } from "@/components/PlanExportImport";
import { formatDateOnly, minutesToLabel, seoulTodayDateString } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await getAllPlans();
  const today = seoulTodayDateString();

  const rows = await Promise.all(
    plans.map(async (plan) => {
      const tasks = await getActiveTasksForPlan(plan.id);
      const logs = await getWorkLogsForTaskIds(tasks.map((t) => t.id));
      const revisions = await getPlanRevisions(plan.id);
      const reflections = await getReflectionsForPlan(plan.id);
      const constellationTasks = buildConstellationTasks(tasks, logs);
      const layout = computeConstellationLayout(constellationTasks, plan.startDate, plan.endDate, today);
      const actualMinutesTotal = constellationTasks.reduce((sum, t) => sum + t.actualMinutesTotal, 0);
      const carriedTo = reflections.find((r) => r.carriedPlanId)?.carriedPlanId ?? null;
      return {
        plan,
        layout,
        doneCount: layout.stars.filter((s) => s.status === "DONE").length,
        totalCount: layout.stars.length,
        actualMinutesTotal,
        revisionCount: revisions.length,
        carriedTo,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="label-coord text-xs text-ink-400">PLAN / OBSERVATION LOG</h1>
          <h2 className="text-xl font-bold text-ink-900">계획</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlanExportImport plans={plans} />
          <Link href="/plans/new" className="inline-flex bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85">
            + 새 계획
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-ink-500">
          아직 계획이 없습니다. 첫 계획을 만들어보세요.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
          {rows.map(({ plan, layout, doneCount, totalCount, actualMinutesTotal, revisionCount, carriedTo }) => (
            <li key={plan.id} className={plan.deletedAt ? "opacity-50" : undefined}>
              <Link
                href={`/plans/${plan.id}`}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <MiniConstellation layout={layout} title={plan.title} />
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
                      {layout.isComplete && (
                        <span className="label-coord border border-ink-900 bg-ink-900 px-1.5 py-0.5 text-[10px] text-white">
                          COMPLETE
                        </span>
                      )}
                    </div>
                    <h3 className="break-words text-base font-bold text-ink-900">{plan.title}</h3>
                    <p className="mt-1 break-words text-sm text-ink-500">
                      <span className="label-coord mr-1 text-[9px] text-ink-400">성공 기준</span>
                      {plan.successCriteria}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-ink-500 sm:shrink-0 sm:text-right">
                  <div>
                    <dt className="sr-only">완료</dt>
                    <dd>
                      완료 {doneCount}/{totalCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">수정 이력</dt>
                    <dd>{revisionCount > 0 ? `이력 ${revisionCount}회` : "이력 없음"}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">예상 시간</dt>
                    <dd>예상 {minutesToLabel(plan.estimatedMinutes)}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">실제 시간</dt>
                    <dd>실제 {minutesToLabel(actualMinutesTotal)}</dd>
                  </div>
                  {(plan.carriedImprovement || carriedTo) && (
                    <div className="col-span-2 flex gap-3 sm:justify-end">
                      {plan.carriedImprovement && <span>← 이어받음</span>}
                      {carriedTo && <span>→ 이어짐</span>}
                    </div>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
