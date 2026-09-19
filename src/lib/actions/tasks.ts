"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { plans, tasks } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { AUTH_REQUIRED_ERROR, GENERIC_SAVE_ERROR } from "@/lib/db-errors";
import { hmToMinutes } from "@/lib/date";
import { getSessionUserId } from "@/lib/session";
import { taskInputSchema, zodErrorToFieldErrors, type TaskInput } from "@/lib/validation";

function readTaskInput(formData: FormData) {
  return {
    planId: formData.get("planId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate"),
    priority: formData.get("priority"),
    tag: formData.get("tag") ?? "",
    estimatedMinutes: hmToMinutes(formData.get("estimatedHours"), formData.get("estimatedMinutesPart")),
  };
}

export async function createTaskAction(
  prevState: ActionState<keyof TaskInput>,
  formData: FormData,
): Promise<ActionState<keyof TaskInput>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { status: "error", message: AUTH_REQUIRED_ERROR };
  }

  const parsed = taskInputSchema.safeParse(readTaskInput(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }

  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, parsed.data.planId), eq(plans.userId, userId), isNull(plans.deletedAt)));
  if (!plan) {
    return { status: "error", message: "존재하지 않거나 삭제된 계획입니다." };
  }

  let newTaskId: number;
  try {
    const [inserted] = await db
      .insert(tasks)
      .values({
        planId: parsed.data.planId,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        dueDate: parsed.data.dueDate,
        priority: parsed.data.priority,
        tag: parsed.data.tag ?? "",
        estimatedMinutes: parsed.data.estimatedMinutes,
      })
      .returning({ id: tasks.id });
    newTaskId = inserted.id;
  } catch (err) {
    console.error("createTaskAction failed", err);
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/tasks");
  revalidatePath(`/plans/${parsed.data.planId}`);
  revalidatePath("/dashboard");
  redirect(`/tasks/${newTaskId}`);
}

export async function updateTaskAction(
  taskId: number,
  prevState: ActionState<keyof TaskInput>,
  formData: FormData,
): Promise<ActionState<keyof TaskInput>> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { status: "error", message: AUTH_REQUIRED_ERROR };
  }

  const parsed = taskInputSchema.safeParse(readTaskInput(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }

  // The target plan for a move must also belong to this user, not just the task's
  // current plan -- otherwise a task could be re-parented onto a stranger's plan id.
  const [targetPlan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, parsed.data.planId), eq(plans.userId, userId)));
  if (!targetPlan) {
    return { status: "error", message: "존재하지 않거나 삭제된 계획입니다." };
  }

  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(tasks.id, taskId), eq(plans.userId, userId), isNull(tasks.deletedAt)));
  if (!existing) {
    return { status: "error", message: "존재하지 않거나 삭제된 할 일입니다." };
  }

  const [updated] = await db
    .update(tasks)
    .set({
      planId: parsed.data.planId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
      tag: parsed.data.tag ?? "",
      estimatedMinutes: parsed.data.estimatedMinutes,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id, planId: tasks.planId });

  if (!updated) {
    return { status: "error", message: "존재하지 않거나 삭제된 할 일입니다." };
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/plans/${updated.planId}`);
  redirect(`/tasks/${taskId}`);
}

export async function softDeleteTaskAction(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId) || taskId <= 0) return;

  const [owned] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .where(and(eq(tasks.id, taskId), eq(plans.userId, userId), isNull(tasks.deletedAt)));
  if (!owned) {
    redirect("/tasks");
  }

  const [updated] = await db
    .update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .returning({ planId: tasks.planId });

  revalidatePath("/tasks");
  if (updated) revalidatePath(`/plans/${updated.planId}`);
  revalidatePath("/dashboard");
  redirect("/tasks");
}
