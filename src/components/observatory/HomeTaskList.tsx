"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { inputClassName } from "@/components/FormField";
import { formatDateOnly, minutesToLabel } from "@/lib/date";
import { DEFAULT_SORT_DESCRIPTION, SORT_OPTIONS, getTaskComparator, type SortOption } from "@/lib/tasks-sort";

export type HomeTaskRow = {
  id: number;
  title: string;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  tag: string;
  dueDate: string;
  estimatedMinutes: number;
  actualMinutes: number;
  createdAt: string;
  isOverdue: boolean;
};

type StatusFilter = "ALL" | "TODO" | "DONE" | "OVERDUE";

/** Accessible list twin of the star field: same tasks, plain rows, client-side search/filter/sort.
 * `compact` trims padding and drops the due/est-actual side column, for use inside the narrow
 * glass panel embedded in the observatory hero (vs. the full-width section below it). */
export function HomeTaskList({
  tasks,
  planId,
  compact = false,
}: {
  tasks: HomeTaskRow[];
  planId: number;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortOption>("default");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (needle && !t.title.toLowerCase().includes(needle)) return false;
      if (status === "TODO" && t.status !== "TODO") return false;
      if (status === "DONE" && t.status !== "DONE") return false;
      if (status === "OVERDUE" && !t.isOverdue) return false;
      return true;
    });
    return [...filtered].sort(getTaskComparator(sort));
  }, [tasks, q, status, sort]);

  return (
    <div className={compact ? "flex flex-col gap-2.5" : "flex flex-col gap-4"}>
      <form
        className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3 sm:flex-row sm:items-end"}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="home-q" className={compact ? "sr-only" : "text-xs font-medium text-ink-500"}>
            검색
          </label>
          <input id="home-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="할 일 제목" className={inputClassName} />
        </div>
        <div className={compact ? "flex gap-2" : "flex flex-col gap-1"}>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="home-status" className={compact ? "sr-only" : "text-xs font-medium text-ink-500"}>
              상태
            </label>
            <select id="home-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputClassName}>
              <option value="ALL">전체</option>
              <option value="TODO">진행 중</option>
              <option value="DONE">완료</option>
              <option value="OVERDUE">지연</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="home-sort" className={compact ? "sr-only" : "text-xs font-medium text-ink-500"}>
              정렬
            </label>
            <select id="home-sort" value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className={inputClassName}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
      {!compact && (
        <p className="label-coord text-[10px] text-ink-400">
          {sort === "default" ? DEFAULT_SORT_DESCRIPTION : `정렬 기준: ${SORT_OPTIONS.find((o) => o.value === sort)?.label}`} · {rows.length}건
        </p>
      )}

      {rows.length === 0 ? (
        <p className="border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-400">조건에 맞는 할 일이 없습니다.</p>
      ) : (
        <ol className={compact ? "flex flex-col divide-y divide-ink-900/10" : "flex flex-col divide-y divide-line border border-line bg-surface"}>
          {rows.map((t, i) => (
            <li key={t.id}>
              <Link
                href={`/tasks/${t.id}`}
                className={
                  compact
                    ? "flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-ink-900/5"
                    : "flex items-start gap-4 p-4 transition-colors hover:bg-surface-muted"
                }
              >
                {!compact && (
                  <span className="label-coord mt-1 w-8 shrink-0 text-[10px] text-ink-400">{String(i + 1).padStart(2, "0")}</span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={t.priority} />
                    <TaskStatusBadge status={t.status} overdue={t.isOverdue} />
                    {t.tag && <span className="text-xs text-ink-400">#{t.tag}</span>}
                  </span>
                  <span className={compact ? "break-words text-sm font-medium text-ink-900" : "break-words font-medium text-ink-900"}>
                    {t.title}
                  </span>
                  {compact && (
                    <span className="font-mono text-[10px] text-ink-400">마감 {formatDateOnly(t.dueDate)}</span>
                  )}
                </span>
                {!compact && (
                  <span className="hidden shrink-0 flex-col items-end font-mono text-xs text-ink-400 sm:flex">
                    <span>마감 {formatDateOnly(t.dueDate)}</span>
                    <span>
                      예상 {minutesToLabel(t.estimatedMinutes)} · 실제 {minutesToLabel(t.actualMinutes)}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className={compact ? "flex flex-wrap gap-3 text-xs" : "flex flex-wrap gap-4 text-sm"}>
        <Link href={`/tasks/new?planId=${planId}`} className="font-medium text-ink-900 underline underline-offset-4">
          + 할 일 추가
        </Link>
        <Link href="/tasks" className="text-ink-500 underline underline-offset-4 hover:text-ink-900">
          전체 할 일 화면 (URL 필터 유지) →
        </Link>
      </div>
    </div>
  );
}
