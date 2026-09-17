import "server-only";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";

export type SeeScope =
  | { type: "plan"; planId: number }
  | { type: "range"; start: string; end: string };

export function encodeScope(scope: SeeScope): string {
  return scope.type === "plan" ? `plan:${scope.planId}` : `range:${scope.start}:${scope.end}`;
}

export function parseScope(raw: string | undefined): SeeScope | null {
  if (!raw) return null;
  const [type, ...rest] = raw.split(":");
  if (type === "plan") {
    const planId = Number(rest[0]);
    return Number.isInteger(planId) && planId > 0 ? { type: "plan", planId } : null;
  }
  if (type === "range") {
    const [start, end] = rest;
    if (/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(end ?? "")) {
      return { type: "range", start, end };
    }
    return null;
  }
  return null;
}

export async function getTasksForScope(scope: SeeScope) {
  if (scope.type === "plan") {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.planId, scope.planId), isNull(tasks.deletedAt)));
  }
  return db
    .select()
    .from(tasks)
    .where(and(gte(tasks.dueDate, scope.start), lte(tasks.dueDate, scope.end), isNull(tasks.deletedAt)));
}

export function describeScope(scope: SeeScope, planTitle?: string): string {
  if (scope.type === "plan") return `계획 기준: ${planTitle ?? `#${scope.planId}`}`;
  return `기간 기준(마감일): ${scope.start} ~ ${scope.end}`;
}
