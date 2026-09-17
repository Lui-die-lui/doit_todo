export type SortableTask = {
  id: number;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate: string;
  createdAt: Date | string;
};

const PRIORITY_RANK: Record<SortableTask["priority"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * Default task sort order (spec-fixed, never changes with data):
 * 1. incomplete before done
 * 2. priority HIGH -> MEDIUM -> LOW
 * 3. due date ascending
 * 4. createdAt ascending
 * 5. id ascending (final deterministic tiebreaker)
 */
export function compareTasksDefaultOrder(a: SortableTask, b: SortableTask): number {
  if (a.status !== b.status) {
    return a.status === "DONE" ? 1 : -1;
  }
  const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rankDiff !== 0) return rankDiff;

  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;

  const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) return createdDiff;

  return a.id - b.id;
}

export const DEFAULT_SORT_DESCRIPTION =
  "기본 정렬: 미완료 먼저 → 우선순위(높음→보통→낮음) → 마감일 빠른 순 → 등록 빠른 순 → ID 오름차순";

export const SORT_OPTIONS = [
  { value: "default", label: "기본 정렬" },
  { value: "dueDateAsc", label: "마감일 빠른순" },
  { value: "dueDateDesc", label: "마감일 늦은순" },
  { value: "createdAtDesc", label: "최근 등록순" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/** Every comparator ends with the same (dueDate ->) id tiebreak so ties never reorder between renders. */
export function getTaskComparator(sort: string): (a: SortableTask, b: SortableTask) => number {
  switch (sort) {
    case "dueDateAsc":
      return (a, b) => (a.dueDate !== b.dueDate ? (a.dueDate < b.dueDate ? -1 : 1) : a.id - b.id);
    case "dueDateDesc":
      return (a, b) => (a.dueDate !== b.dueDate ? (a.dueDate > b.dueDate ? -1 : 1) : a.id - b.id);
    case "createdAtDesc":
      return (a, b) => {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return diff !== 0 ? diff : a.id - b.id;
      };
    default:
      return compareTasksDefaultOrder;
  }
}
