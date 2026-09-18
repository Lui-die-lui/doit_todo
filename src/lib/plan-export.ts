import type { Plan } from "@/db/schema";
import { priorityValues } from "./validation";

/** sessionStorage key the "새 계획" form checks on mount to pre-fill itself from an import. */
export const PLAN_IMPORT_STORAGE_KEY = "doit:plan-import";

export type PlanExportJson = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: (typeof priorityValues)[number];
  successCriteria: string;
  estimatedMinutes: number;
  carriedImprovement: string;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Plan fields worth carrying across a JSON export/import round trip -- excludes id,
 * createdAt/updatedAt/deletedAt, and sourceReflectionId (a foreign key that would dangle
 * or point at an unrelated row once imported into a different plan/database). */
export function toPlanExportJson(plan: Plan): PlanExportJson {
  return {
    title: plan.title,
    description: plan.description,
    startDate: plan.startDate,
    endDate: plan.endDate,
    priority: plan.priority,
    successCriteria: plan.successCriteria,
    estimatedMinutes: plan.estimatedMinutes,
    carriedImprovement: plan.carriedImprovement ?? "",
  };
}

/** Loosely validates a parsed JSON value as an importable plan -- just enough structural
 * checking to give a clear error for an unrelated or corrupt file. The real validation is
 * `planInputSchema`, applied server-side once the user reviews and submits the pre-filled form. */
export function parsePlanExportJson(raw: string): PlanExportJson | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.title !== "string" || v.title.trim().length === 0) return null;
  if (typeof v.startDate !== "string" || !DATE_ONLY_RE.test(v.startDate)) return null;
  if (typeof v.endDate !== "string" || !DATE_ONLY_RE.test(v.endDate)) return null;
  if (typeof v.priority !== "string" || !(priorityValues as readonly string[]).includes(v.priority)) return null;
  if (typeof v.successCriteria !== "string") return null;
  if (typeof v.estimatedMinutes !== "number" || !Number.isFinite(v.estimatedMinutes)) return null;

  return {
    title: v.title,
    description: typeof v.description === "string" ? v.description : "",
    startDate: v.startDate,
    endDate: v.endDate,
    priority: v.priority as (typeof priorityValues)[number],
    successCriteria: v.successCriteria,
    estimatedMinutes: v.estimatedMinutes,
    carriedImprovement: typeof v.carriedImprovement === "string" ? v.carriedImprovement : "",
  };
}
