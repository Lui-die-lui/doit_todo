"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Plan, Task, WorkLog } from "@/db/schema";
import { formatDateTimeSeoul, minutesToLabel } from "@/lib/date";

type LogRow = { workLog: WorkLog; task: Task; plan: Plan };

const FILTERS = ["전체", "오늘", "이번 주", "완료", "처리"] as const;
type Filter = (typeof FILTERS)[number];

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Client-side only filter over the already server-fetched work log list -- no
 * extra query, no Server Action. 전체/오늘/이번 주 filter by the log's Seoul
 * calendar date; 완료/처리 filter by the owning task's current status. */
export function WorkLogFilterList({ logs, today }: { logs: LogRow[]; today: string }) {
  const [filter, setFilter] = useState<Filter>("전체");
  const weekStart = useMemo(() => mondayOf(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const filtered = useMemo(() => {
    return logs.filter(({ workLog, task }) => {
      const day = formatDateTimeSeoul(workLog.startAt).slice(0, 10);
      switch (filter) {
        case "오늘":
          return day === today;
        case "이번 주":
          return day >= weekStart && day <= weekEnd;
        case "완료":
          return task.status === "DONE";
        case "처리":
          return task.status === "TODO";
        default:
          return true;
      }
    });
  }, [logs, filter, today, weekStart, weekEnd]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    for (const row of filtered) {
      const day = formatDateTimeSeoul(row.workLog.startAt).slice(0, 10);
      const bucket = map.get(day) ?? [];
      bucket.push(row);
      map.set(day, bucket);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="실행 기록 필터" className="flex flex-wrap gap-1 border border-line bg-surface p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-[38px] flex-1 px-3 text-sm font-medium transition-colors ${
              filter === f ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-1 border border-dashed border-line-strong bg-surface p-6 text-center">
          <p className="text-sm font-medium text-ink-700">
            {logs.length === 0 ? "아직 남겨진 실행 기록이 없습니다." : "조건에 맞는 실행 기록이 없습니다."}
          </p>
          {logs.length === 0 && (
            <p className="text-sm text-ink-500">할 일을 시작하면 실제 소요 시간이 이곳에 쌓입니다.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {[...logsByDate.entries()].map(([day, rows]) => {
            const dayTotal = rows.reduce((sum, r) => sum + r.workLog.actualMinutes, 0);
            return (
              <section key={day} aria-label={`${day} 실행 기록`}>
                <div className="mb-3 flex items-baseline gap-3 border-b border-ink-900 pb-1">
                  <span className="font-mono text-sm font-semibold text-ink-900">{day}</span>
                  <span className="label-coord text-[10px] text-ink-400">
                    {rows.length} ENTRIES · {minutesToLabel(dayTotal)}
                  </span>
                </div>
                <ul className="flex flex-col border-l border-line-strong pl-4">
                  {rows.map(({ workLog, task, plan }) => (
                    <li key={workLog.id} className="relative border-b border-line py-4 last:border-b-0">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[20.5px] top-[1.35rem] h-2 w-2 rounded-full border border-ink-900 bg-surface"
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-mono text-xs text-ink-900">
                          {formatDateTimeSeoul(workLog.startAt).slice(11)} – {formatDateTimeSeoul(workLog.endAt).slice(11)}
                        </span>
                        <span className="font-mono text-sm font-semibold text-ink-900">
                          {minutesToLabel(workLog.actualMinutes)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm text-ink-700">
                        <Link href={`/plans/${plan.id}`} className="text-ink-500 underline underline-offset-2">
                          {plan.title}
                        </Link>{" "}
                        ›{" "}
                        <Link href={`/tasks/${task.id}`} className="font-medium underline underline-offset-2">
                          {task.title}
                        </Link>
                      </p>
                      {workLog.blockerReason && (
                        <p className="mt-1 border-l-2 border-dashed border-ink-500 pl-2 text-sm text-ink-700">
                          <span className="label-coord mr-1 text-[9px] text-ink-400">BLOCKED</span>
                          {workLog.blockerReason}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-[11px] text-ink-400">기록일 {formatDateTimeSeoul(workLog.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
