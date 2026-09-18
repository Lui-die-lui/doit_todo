import Link from "next/link";
import { minutesToLabel } from "@/lib/date";

/** "SEE / 예상 대 실제". `compact` is the plain desktop corner readout; the default is the
 * full-width mobile/tablet section. */
export function EstimateVsActualPanel({
  planId,
  estimatedMinutes,
  actualMinutes,
  diffMinutes,
  compact = false,
}: {
  planId: number;
  estimatedMinutes: number;
  actualMinutes: number;
  diffMinutes: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? undefined : "flex flex-col gap-4"}>
      <div className="border-b border-ink-900 pb-2">
        <h2 className="label-coord text-[11px] text-ink-900">SEE / 예상 대 실제</h2>
      </div>
      <dl
        className={
          compact
            ? "mt-2 flex flex-col gap-1.5 font-mono text-[11px]"
            : "flex flex-col gap-2 font-mono text-sm"
        }
      >
        <div className="flex justify-between gap-4">
          <dt className="label-coord text-[10px] text-ink-400">EST.</dt>
          <dd className="text-ink-900">{minutesToLabel(estimatedMinutes)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="label-coord text-[10px] text-ink-400">ACTUAL</dt>
          <dd className="text-ink-900">{minutesToLabel(actualMinutes)}</dd>
        </div>
        <div className={compact ? "flex justify-between gap-4 border-t border-line pt-1.5" : "flex justify-between gap-4 border-t border-line pt-2"}>
          <dt className="label-coord text-[10px] text-ink-400">DIFF</dt>
          <dd className="font-semibold text-ink-900">
            {diffMinutes > 0 ? "+" : ""}
            {minutesToLabel(diffMinutes)}
          </dd>
        </div>
      </dl>
      <Link
        href={`/see?planId=${planId}`}
        className={
          compact
            ? "label-coord mt-3 block rounded-sm border border-line-strong px-4 py-2 text-center text-[10px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
            : "label-coord rounded-sm border border-line-strong px-4 py-2.5 text-center text-[11px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
        }
      >
        SEE / 돌아보기 열기 →
      </Link>
    </div>
  );
}
