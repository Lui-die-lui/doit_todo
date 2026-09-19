import Link from "next/link";
import { formatDateTimeSeoul, minutesToLabel } from "@/lib/date";

export type HomeRecentLog = {
  id: number;
  taskId: number;
  taskTitle: string;
  startAt: string;
  endAt: string;
  actualMinutes: number;
  blockerReason: string | null;
};

/** "DO / 최근 실행 기록". `compact` is the plain desktop corner preview (no blocker
 * note); the default is the full-width mobile/tablet section. */
export function RecentLogsPanel({
  logs,
  compact = false,
  headingId,
}: {
  logs: HomeRecentLog[];
  compact?: boolean;
  headingId?: string;
}) {
  return (
    <div className={compact ? undefined : "flex flex-col gap-4"}>
      <div className="flex items-baseline justify-between border-b border-ink-900 pb-2">
        <h2 id={headingId} className="label-coord text-[11px] text-ink-900">
          DO / 최근 실행 기록
        </h2>
        <Link href="/do" className="label-coord text-[10px] text-ink-500 hover:text-ink-900">
          전체 기록 →
        </Link>
      </div>
      {logs.length === 0 ? (
        compact ? (
          <p className="mt-3 text-[11px] text-ink-400">아직 실행 기록이 없습니다.</p>
        ) : (
          <p className="border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-400">
            아직 실행 기록이 없습니다. 첫 기록을 남기면 별 주변에 작은 궤적이 생깁니다.
          </p>
        )
      ) : (
        <ul className="flex flex-col border-l border-line-strong pl-4">
          {logs.map((log) => (
            <li
              key={log.id}
              className={
                compact
                  ? "relative border-b border-line py-2 text-xs last:border-b-0"
                  : "relative border-b border-line py-3 text-sm last:border-b-0"
              }
            >
              <span
                aria-hidden="true"
                className={
                  compact
                    ? "absolute -left-[18.5px] top-[0.95rem] h-1.5 w-1.5 rounded-full border border-ink-900 bg-surface"
                    : "absolute -left-[20.5px] top-[1.1rem] h-2 w-2 rounded-full border border-ink-900 bg-surface"
                }
              />
              <div
                className={
                  compact
                    ? "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    : "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                }
              >
                <span className={compact ? "font-mono text-[10px] text-ink-900" : "font-mono text-xs text-ink-900"}>
                  {formatDateTimeSeoul(log.startAt)} – {formatDateTimeSeoul(log.endAt).slice(11)}
                </span>
                <span
                  className={
                    compact
                      ? "font-mono text-[11px] font-semibold text-ink-900"
                      : "font-mono font-semibold text-ink-900"
                  }
                >
                  {minutesToLabel(log.actualMinutes)}
                </span>
              </div>
              <p className={compact ? "mt-0.5 truncate text-[11px] text-ink-700" : "mt-0.5 text-ink-700"}>
                <Link href={`/tasks/${log.taskId}`} className="underline underline-offset-2">
                  {log.taskTitle}
                </Link>
              </p>
              {!compact && log.blockerReason && (
                <p className="mt-1 border-l-2 border-dashed border-ink-500 pl-2 text-sm text-ink-700">
                  <span className="label-coord mr-1 text-[9px] text-ink-400">BLOCKED</span>
                  {log.blockerReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
