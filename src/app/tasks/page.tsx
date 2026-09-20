import Link from "next/link";
import { getAllActiveTasksWithPlan, getDistinctTags } from "@/lib/queries";
import { formatDateOnly, isOverdue, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { priorityLabels, priorityValues } from "@/lib/validation";
import { DEFAULT_SORT_DESCRIPTION, SORT_OPTIONS, getTaskComparator, type SortOption } from "@/lib/tasks-sort";
import { inputClassName } from "@/components/FormField";
import { Select } from "@/components/ui/Select";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

type StatusFilter = "ALL" | "TODO" | "DONE" | "OVERDUE";

const STATUS_OPTIONS = [
  { value: "ALL", label: "전체" },
  { value: "TODO", label: "진행 중" },
  { value: "DONE", label: "완료" },
  { value: "OVERDUE", label: "지연" },
];
const priorityOptions = [
  { value: "ALL", label: "전체" },
  ...priorityValues.map((p) => ({ value: p, label: priorityLabels[p] })),
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; tag?: string; sort?: string }>;
}) {
  const session = await requireSessionOrRedirect();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (["ALL", "TODO", "DONE", "OVERDUE"].includes(sp.status ?? "") ? sp.status : "ALL") as StatusFilter;
  const priority = (priorityValues as readonly string[]).includes(sp.priority ?? "") ? (sp.priority as string) : "ALL";
  const tag = (sp.tag ?? "ALL").trim() || "ALL";
  const sort = (SORT_OPTIONS.some((o) => o.value === sp.sort) ? sp.sort : "default") as SortOption;

  const [rows, tags] = await Promise.all([getAllActiveTasksWithPlan(session.user.id), getDistinctTags(session.user.id)]);
  const today = seoulTodayDateString();

  const filtered = rows.filter(({ task }) => {
    if (q) {
      const haystack = `${task.title} ${task.description}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    const overdue = isOverdue(task.dueDate, task.status, today);
    if (status === "TODO" && task.status !== "TODO") return false;
    if (status === "DONE" && task.status !== "DONE") return false;
    if (status === "OVERDUE" && !overdue) return false;
    if (priority !== "ALL" && task.priority !== priority) return false;
    if (tag !== "ALL" && task.tag !== tag) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => getTaskComparator(sort)(a.task, b.task));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="label-coord text-xs text-ink-400">TASKS / INDEX</h1>
          <h2 className="text-xl font-bold text-ink-900">할 일</h2>
        </div>
        <Link href="/tasks/new" className="inline-flex rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85">
          + 새 할 일
        </Link>
      </div>

      <form method="get" className="grid grid-cols-2 gap-3 border border-line bg-surface p-4 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex flex-col gap-1 sm:min-w-[160px] sm:flex-1">
          <label htmlFor="q" className="text-xs font-medium text-ink-500">
            검색(제목·설명)
          </label>
          <input id="q" name="q" defaultValue={q} className={inputClassName} placeholder="검색어" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-ink-500">
            상태
          </label>
          <Select id="status" name="status" size="sm" defaultValue={status} options={STATUS_OPTIONS} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="priority" className="text-xs font-medium text-ink-500">
            우선순위
          </label>
          <Select id="priority" name="priority" size="sm" defaultValue={priority} options={priorityOptions} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="tag" className="text-xs font-medium text-ink-500">
            태그
          </label>
          <Select
            id="tag"
            name="tag"
            size="md"
            defaultValue={tag}
            options={[{ value: "ALL", label: "전체" }, ...tags.map((t) => ({ value: t, label: t }))]}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="sort" className="text-xs font-medium text-ink-500">
            정렬
          </label>
          <Select
            id="sort"
            name="sort"
            size="md"
            defaultValue={sort}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <button
          type="submit"
          className="col-span-2 inline-flex min-h-[42px] items-center justify-center rounded-sm bg-ink-900 px-5 text-sm font-medium text-white hover:opacity-90 sm:col-span-1"
        >
          필터 적용
        </button>
      </form>

      <p className="label-coord text-[10px] text-ink-400">
        {sort === "default" ? DEFAULT_SORT_DESCRIPTION : `정렬 기준: ${SORT_OPTIONS.find((o) => o.value === sort)?.label}`}
      </p>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-400">
          조건에 맞는 할 일이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
          {sorted.map(({ task, plan }) => {
            const overdue = isOverdue(task.dueDate, task.status, today);
            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex flex-col gap-1 p-4 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <TaskStatusBadge status={task.status} overdue={overdue} />
                      {task.tag && <span className="text-xs text-ink-400">#{task.tag}</span>}
                    </div>
                    <span className="font-medium text-ink-900">{task.title}</span>
                    <span className="text-xs text-ink-400">계획: {plan.title}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 font-mono text-xs text-ink-400">
                    <span>마감 {formatDateOnly(task.dueDate)}</span>
                    <span>예상 {minutesToLabel(task.estimatedMinutes)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
