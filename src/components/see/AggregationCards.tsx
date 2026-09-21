import { StatCard } from "@/components/StatCard";
import { minutesToLabel } from "@/lib/date";
import type { RetroAggregation } from "@/lib/aggregations";

/** The aggregation stat grid + diff row. On /see it is shared by the standalone full-width section
 * (mobile/tablet) and the version embedded into the left column below the plan summary card
 * (desktop); the plan detail page embeds the same `compact` version under its summary cards. */
export function AggregationCards({
  scopeParam,
  aggregation,
  compact = false,
}: {
  scopeParam: string;
  aggregation: RetroAggregation;
  compact?: boolean;
}) {
  return (
    <>
      <div className={`grid gap-px border border-line bg-line ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
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
    </>
  );
}
