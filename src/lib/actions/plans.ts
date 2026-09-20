"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { planRevisions, plans, reflections } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { AUTH_REQUIRED_ERROR, GENERIC_SAVE_ERROR } from "@/lib/db-errors";
import { hmToMinutes } from "@/lib/date";
import { mergePlanOrder, parseOrderedPlanIds } from "@/lib/plan-order";
import { PLAN_ORDER } from "@/lib/queries";
import { getSessionUserId } from "@/lib/session";
import {
  planInputSchema,
  planRevisionInputSchema,
  zodErrorToFieldErrors,
  type PlanInput,
} from "@/lib/validation";

function readPlanInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    priority: formData.get("priority"),
    successCriteria: formData.get("successCriteria"),
    estimatedMinutes: hmToMinutes(formData.get("estimatedHours"), formData.get("estimatedMinutesPart")),
    carriedImprovement: formData.get("carriedImprovement") || null,
    sourceReflectionId: formData.get("sourceReflectionId") || null,
  };
}

export async function createPlanAction(
  prevState: ActionState<keyof PlanInput>,
  formData: FormData,
): Promise<ActionState<keyof PlanInput>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { status: "error", message: AUTH_REQUIRED_ERROR };
  }

  const parsed = planInputSchema.safeParse(readPlanInput(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }

  let newPlanId: number;
  try {
    const requestedSourceReflectionId = parsed.data.sourceReflectionId ?? null;
    newPlanId = await db.transaction(async (tx) => {
      // A sourceReflectionId is only honored if that reflection belongs (via its plan)
      // to this same user -- otherwise a forged id could redirect a stranger's
      // reflection's "carried to" pointer at a plan they don't own.
      let sourceReflectionId: number | null = null;
      if (requestedSourceReflectionId) {
        const [owned] = await tx
          .select({ id: reflections.id })
          .from(reflections)
          .innerJoin(plans, eq(reflections.planId, plans.id))
          .where(and(eq(reflections.id, requestedSourceReflectionId), eq(plans.userId, userId)));
        sourceReflectionId = owned?.id ?? null;
      }

      // A new plan goes to the front of the owner's order (matching the list's old
      // newest-first behavior): one step before their smallest explicit position.
      const [{ minOrder }] = await tx
        .select({ minOrder: sql<number | null>`min(${plans.sortOrder})` })
        .from(plans)
        .where(eq(plans.userId, userId));

      const [inserted] = await tx
        .insert(plans)
        .values({
          userId,
          sortOrder: (minOrder ?? 0) - 1,
          title: parsed.data.title,
          description: parsed.data.description ?? "",
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          priority: parsed.data.priority,
          successCriteria: parsed.data.successCriteria,
          estimatedMinutes: parsed.data.estimatedMinutes,
          carriedImprovement: parsed.data.carriedImprovement ?? null,
          sourceReflectionId,
        })
        .returning({ id: plans.id });

      if (sourceReflectionId) {
        await tx
          .update(reflections)
          .set({ carriedPlanId: inserted.id, updatedAt: new Date() })
          .where(eq(reflections.id, sourceReflectionId));
      }
      return inserted.id;
    });
  } catch (err) {
    console.error("createPlanAction failed", err);
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  redirect(`/plans/${newPlanId}`);
}

export async function revisePlanAction(
  planId: number,
  prevState: ActionState<keyof PlanInput | "reason">,
  formData: FormData,
): Promise<ActionState<keyof PlanInput | "reason">> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { status: "error", message: AUTH_REQUIRED_ERROR };
  }

  const parsed = planRevisionInputSchema.safeParse({
    ...readPlanInput(formData),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }

  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(plans)
        .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
        .for("update");

      if (!current || current.deletedAt) {
        throw new Error("PLAN_NOT_FOUND");
      }

      const [{ maxVersion }] = await tx
        .select({ maxVersion: sql<number>`coalesce(max(${planRevisions.version}), 0)::int` })
        .from(planRevisions)
        .where(eq(planRevisions.planId, planId));
      const nextVersion = (maxVersion ?? 0) + 1;

      await tx.insert(planRevisions).values({
        planId,
        version: nextVersion,
        prevTitle: current.title,
        prevDescription: current.description,
        prevStartDate: current.startDate,
        prevEndDate: current.endDate,
        prevPriority: current.priority,
        prevSuccessCriteria: current.successCriteria,
        prevEstimatedMinutes: current.estimatedMinutes,
        reason: parsed.data.reason,
      });

      await tx
        .update(plans)
        .set({
          title: parsed.data.title,
          description: parsed.data.description ?? "",
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          priority: parsed.data.priority,
          successCriteria: parsed.data.successCriteria,
          estimatedMinutes: parsed.data.estimatedMinutes,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, planId));
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return { status: "error", message: "존재하지 않거나 이미 삭제된 계획입니다." };
    }
    console.error("revisePlanAction failed", err);
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/history`);
  revalidatePath("/plans");
  revalidatePath("/dashboard");
  redirect(`/plans/${planId}`);
}

export type ReorderPlansResult = { ok: true } | { ok: false; message: string };

/**
 * Saves the owner's manual plan order. `orderedIds` is the full sequence they arranged; it is
 * only honored if every id is one of *their own active* plans -- one foreign, archived or
 * unknown id rejects the whole request and nothing is written (a stranger's id is
 * indistinguishable from a missing one, same as the 404 policy elsewhere). The user id comes
 * from the session, never from the request.
 */
export async function reorderPlansAction(orderedIds: number[]): Promise<ReorderPlansResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, message: AUTH_REQUIRED_ERROR };

  const ids = parseOrderedPlanIds(orderedIds);
  if (!ids) return { ok: false, message: "순서를 저장할 수 없습니다. 다시 시도해 주세요." };

  try {
    await db.transaction(async (tx) => {
      const current = await tx
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.userId, userId), isNull(plans.deletedAt)))
        .orderBy(...PLAN_ORDER)
        .for("update");
      const currentIds = current.map((row) => row.id);
      const owned = new Set(currentIds);
      if (ids.some((id) => !owned.has(id))) throw new Error("PLAN_NOT_FOUND");

      const finalOrder = mergePlanOrder(ids, currentIds);
      for (let position = 0; position < finalOrder.length; position++) {
        await tx
          .update(plans)
          .set({ sortOrder: position })
          .where(and(eq(plans.id, finalOrder[position]), eq(plans.userId, userId)));
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return { ok: false, message: "존재하지 않거나 이미 삭제된 계획이 포함되어 있습니다." };
    }
    console.error("reorderPlansAction failed", err);
    return { ok: false, message: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  revalidatePath("/see");
  return { ok: true };
}

export async function archivePlanAction(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const planId = Number(formData.get("planId"));
  if (!Number.isInteger(planId) || planId <= 0) return;

  await db
    .update(plans)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), isNull(plans.deletedAt)));

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  revalidatePath(`/plans/${planId}`);
  redirect("/plans");
}
