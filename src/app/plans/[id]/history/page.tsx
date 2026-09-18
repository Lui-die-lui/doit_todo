import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlanById, getPlanRevisions } from "@/lib/queries";
import { PriorityBadge } from "@/components/Badges";
import { formatDateOnly, formatDateTimeSeoul, minutesToLabel } from "@/lib/date";
import { priorityLabels } from "@/lib/validation";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlanHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect();
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const plan = await getPlanById(session.user.id, planId);
  if (!plan) notFound();

  const revisions = await getPlanRevisions(session.user.id, planId); // newest version first
  const oldestRevision = revisions[revisions.length - 1];
  const original = oldestRevision
    ? {
        title: oldestRevision.prevTitle,
        description: oldestRevision.prevDescription,
        startDate: oldestRevision.prevStartDate,
        endDate: oldestRevision.prevEndDate,
        priority: oldestRevision.prevPriority,
        successCriteria: oldestRevision.prevSuccessCriteria,
        estimatedMinutes: oldestRevision.prevEstimatedMinutes,
        createdAt: plan.createdAt,
      }
    : plan;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="label-coord text-xs text-ink-400">PLAN / REVISIONS</h1>
          <h2 className="text-xl font-bold text-ink-900">{plan.title}</h2>
        </div>
        <Link href={`/plans/${plan.id}`} className="text-sm font-medium text-ink-900 hover:underline">
          ← 계획으로 돌아가기
        </Link>
      </div>

      <section className="border border-ink-900 bg-surface p-4">
        <h3 className="label-coord mb-2 text-[10px] text-ink-900">현재 (최신) 계획</h3>
        <RevisionCard
          title={plan.title}
          description={plan.description}
          startDate={plan.startDate}
          endDate={plan.endDate}
          priority={plan.priority}
          successCriteria={plan.successCriteria}
          estimatedMinutes={plan.estimatedMinutes}
        />
        <p className="mt-2 font-mono text-xs text-ink-400">최종 수정: {formatDateTimeSeoul(plan.updatedAt)}</p>
      </section>

      <section className="border border-line bg-surface p-4">
        <h3 className="label-coord mb-2 text-[10px] text-ink-400">처음 계획</h3>
        <RevisionCard
          title={original.title}
          description={original.description}
          startDate={original.startDate}
          endDate={original.endDate}
          priority={original.priority}
          successCriteria={original.successCriteria}
          estimatedMinutes={original.estimatedMinutes}
        />
        <p className="mt-2 font-mono text-xs text-ink-400">최초 작성: {formatDateTimeSeoul(plan.createdAt)}</p>
      </section>

      {revisions.length === 0 ? (
        <p className="text-sm text-ink-400">아직 수정된 적이 없습니다.</p>
      ) : (
        <section aria-labelledby="revisions-heading" className="flex flex-col gap-3">
          <h3 id="revisions-heading" className="label-coord text-[10px] text-ink-400">
            변경 이력 ({revisions.length}건, 최신순)
          </h3>
          {revisions.map((rev) => (
            <div key={rev.id} className="border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-900">버전 v{rev.version} 수정 전 내용</span>
                <span className="font-mono text-xs text-ink-400">변경 시각: {formatDateTimeSeoul(rev.createdAt)}</span>
              </div>
              <RevisionCard
                title={rev.prevTitle}
                description={rev.prevDescription}
                startDate={rev.prevStartDate}
                endDate={rev.prevEndDate}
                priority={rev.prevPriority}
                successCriteria={rev.prevSuccessCriteria}
                estimatedMinutes={rev.prevEstimatedMinutes}
              />
              <p className="mt-2 border-l-2 border-ink-900 bg-surface-muted px-3 py-2 text-sm text-ink-700">
                <strong className="text-ink-900">수정 이유:</strong> {rev.reason}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function RevisionCard({
  title,
  description,
  startDate,
  endDate,
  priority,
  successCriteria,
  estimatedMinutes,
}: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  successCriteria: string;
  estimatedMinutes: number;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm text-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{title}</span>
        <PriorityBadge priority={priority} />
        <span className="font-mono text-xs text-ink-400">
          {formatDateOnly(startDate)} – {formatDateOnly(endDate)}
        </span>
      </div>
      {description && <p className="whitespace-pre-wrap text-ink-500">{description}</p>}
      <p className="text-ink-500">
        <strong className="text-ink-900">성공 기준:</strong> {successCriteria}
      </p>
      <p className="text-xs text-ink-400">
        예상 시간 {minutesToLabel(estimatedMinutes)} · 우선순위 {priorityLabels[priority]}
      </p>
    </div>
  );
}
