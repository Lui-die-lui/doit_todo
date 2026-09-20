"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Plan, Task } from "@/db/schema";
import { formatDateOnly, isOverdue } from "@/lib/date";
import { CompletionControls } from "@/components/CompletionControls";
import { TaskStatusBadge } from "@/components/Badges";
import { Select } from "@/components/ui/Select";

type TaskRow = { task: Task; plan: Plan };

const SORTS = ["미완료 우선", "완료 우선", "최신 등록순", "마감일 빠른순", "마감일 늦은순"] as const;
type SortKey = (typeof SORTS)[number];

const PAGE_SIZE = 10;

function compareByDueDate(a: TaskRow, b: TaskRow): number {
  return a.task.dueDate.localeCompare(b.task.dueDate) || b.task.createdAt.getTime() - a.task.createdAt.getTime();
}

/** Client-side search/sort/pagination over the already server-fetched active
 * task list -- no extra query, no Server Action. Mirrors the filter pattern
 * used for the 실행 기록 list beside it (WorkLogFilterList). */
export function ActiveTaskFilterList({
  tasks,
  today,
  highlightTaskId,
}: {
  tasks: TaskRow[];
  today: string;
  highlightTaskId?: number;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("미완료 우선");
  const [planFilter, setPlanFilter] = useState<number | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const plans = useMemo(() => {
    const map = new Map<number, string>();
    for (const { plan } of tasks) map.set(plan.id, plan.title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko"));
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = q
      ? tasks.filter(
          ({ task, plan }) => task.title.toLowerCase().includes(q) || plan.title.toLowerCase().includes(q)
        )
      : tasks;
    if (planFilter !== "ALL") {
      rows = rows.filter(({ plan }) => plan.id === planFilter);
    }

    const sorted = [...rows];
    switch (sort) {
      case "미완료 우선":
        sorted.sort(
          (a, b) => Number(a.task.status === "DONE") - Number(b.task.status === "DONE") || compareByDueDate(a, b)
        );
        break;
      case "완료 우선":
        sorted.sort(
          (a, b) => Number(b.task.status === "DONE") - Number(a.task.status === "DONE") || compareByDueDate(a, b)
        );
        break;
      case "마감일 빠른순":
        sorted.sort(compareByDueDate);
        break;
      case "마감일 늦은순":
        sorted.sort((a, b) => compareByDueDate(b, a));
        break;
      default:
        sorted.sort((a, b) => b.task.createdAt.getTime() - a.task.createdAt.getTime());
    }
    return sorted;
  }, [tasks, query, sort, planFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, sort, planFilter]);

  useEffect(() => {
    if (!highlightTaskId) return;
    const idx = filtered.findIndex(({ task }) => task.id === highlightTaskId);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    // Only jump to the highlighted task once, on mount -- not every time
    // filtering reshuffles its position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTaskId]);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 border border-dashed border-line-strong bg-surface p-8 text-center">
        <p className="text-base font-bold text-ink-900">지금 실행할 궤도가 없습니다.</p>
        <p className="max-w-xs text-sm text-ink-500">계획에서 할 일을 추가하면 여기에서 실행 시간을 기록할 수 있어요.</p>
        <Link
          href="/tasks/new"
          className="inline-flex min-h-[42px] items-center justify-center rounded-sm bg-ink-900 px-5 text-sm font-medium text-white hover:opacity-85"
        >
          할 일 추가
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="할 일 또는 계획 검색"
          aria-label="할 일 검색"
          className="min-h-[42px] w-full min-w-0 border border-line-strong bg-surface px-3.5 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-900 focus:border-ink-900 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink-900 sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          {plans.length > 1 && (
            <Select
              size="md"
              aria-label="계획 필터"
              value={String(planFilter)}
              onValueChange={(v) => setPlanFilter(v === "ALL" ? "ALL" : Number(v))}
              options={[
                { value: "ALL", label: "전체 계획" },
                ...plans.map(([id, title]) => ({ value: String(id), label: title })),
              ]}
            />
          )}
          <Select
            size="md"
            aria-label="정렬 기준"
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            options={SORTS.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-1 border border-dashed border-line-strong bg-surface p-6 text-center">
          <p className="text-sm font-medium text-ink-700">검색 조건에 맞는 할 일이 없습니다.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
            {paged.map(({ task, plan }) => (
              <li
                key={task.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 ${
                  highlightTaskId === task.id ? "bg-surface-muted" : ""
                }`}
              >
                <div>
                  <div className="mb-1">
                    <TaskStatusBadge status={task.status} overdue={isOverdue(task.dueDate, task.status, today)} />
                  </div>
                  <Link href={`/tasks/${task.id}`} className="text-[15px] font-medium text-ink-900 hover:underline">
                    {task.title}
                  </Link>
                  <p className="text-xs text-ink-400">
                    {plan.title} · 마감 {formatDateOnly(task.dueDate)}
                  </p>
                </div>
                <CompletionControls taskId={task.id} status={task.status} />
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <nav aria-label="할 일 목록 페이지" className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="min-h-[34px] min-w-[34px] border border-line-strong px-2 text-sm text-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={page === p ? "page" : undefined}
                  className={`min-h-[34px] min-w-[34px] border px-2 text-sm ${
                    page === p ? "border-ink-900 bg-ink-900 text-white" : "border-line-strong text-ink-700"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="min-h-[34px] min-w-[34px] border border-line-strong px-2 text-sm text-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
