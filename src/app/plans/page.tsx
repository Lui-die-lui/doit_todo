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
import { PlanOrbitGraphic } from "@/components/plans/PlanOrbitGraphic";
import { PageHeader } from "@/components/PageHeader";
import { formatDateOnly, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requireSessionOrRedirect();
  const userId = session.user.id;
  const plans = await getAllPlans(userId);
  const today = seoulTodayDateString();

  const rows = await Promise.all(
    plans.map(async (plan) => {
      const tasks = await getActiveTasksForPlan(userId, plan.id);
      const logs = await getWorkLogsForTaskIds(userId, tasks.map((t) => t.id));
      const revisions = await getPlanRevisions(userId, plan.id);
      const reflections = await getReflectionsForPlan(userId, plan.id);
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

  const hasPlans = rows.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="PLAN / OBSERVATION LOG"
        title="계획"
        description="목표를 세우고 실행 가능한 궤도로 나눕니다."
        action={
          <>
            <PlanExportImport plans={plans} />
            {hasPlans ? (
              <a
                href="/api/export"
                className="inline-flex min-h-[42px] items-center rounded-sm border border-line-strong bg-surface px-5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900"
              >
                전체 기록 내보내기
              </a>
            ) : (
              <span
                aria-disabled="true"
                title="내보낼 계획이 없습니다."
                className="inline-flex min-h-[42px] cursor-not-allowed items-center rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink-400"
              >
                전체 기록 내보내기
              </span>
            )}
            <Link
              href="/plans/new"
              className="inline-flex min-h-[42px] items-center rounded-sm bg-ink-900 px-6 text-sm font-medium text-white hover:opacity-85"
            >
              + 새 계획
            </Link>
          </>
        }
      />

      {!hasPlans ? (
        <div className="grid min-h-[380px] grid-cols-1 items-center gap-8 border border-line bg-surface p-8 sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col items-start gap-4">
            <p className="label-coord text-[11px] text-ink-400">FIRST OBSERVATION</p>
            <h2 className="text-xl font-bold leading-snug text-ink-900 sm:text-2xl">
              첫 번째 계획 궤도를 만들어보세요.
            </h2>
            <p className="text-sm text-ink-500 sm:text-base">
              기간과 목표를 정하고, 실행할 할 일을 궤도에 배치할 수 있어요.
            </p>
            <Link
              href="/plans/new"
              className="inline-flex min-h-[42px] items-center justify-center rounded-sm bg-ink-900 px-6 text-sm font-medium text-white hover:opacity-85"
            >
              + 새 계획 만들기
            </Link>
          </div>
          <div className="flex items-center justify-center">
            <PlanOrbitGraphic />
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ plan, layout, doneCount, totalCount, actualMinutesTotal, revisionCount, carriedTo }) => (
            <li key={plan.id} className={plan.deletedAt ? "opacity-50" : undefined}>
              <Link
                href={`/plans/${plan.id}`}
                className="flex h-full flex-col gap-4 border border-line bg-surface p-5 transition-colors hover:border-ink-900 hover:bg-surface-muted"
              >
                <div className="flex items-center gap-4">
                  <MiniConstellation layout={layout} title={plan.title} />
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={plan.priority} />
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
                    <span className="font-mono text-xs text-ink-400">
                      {formatDateOnly(plan.startDate)} – {formatDateOnly(plan.endDate)}
                    </span>
                  </div>
                </div>

                <p className="break-words text-sm text-ink-500">
                  <span className="label-coord mr-1 text-[9px] text-ink-400">성공 기준</span>
                  {plan.successCriteria}
                </p>

                <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-xs text-ink-500">
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
                    <div className="col-span-2 flex gap-3">
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
