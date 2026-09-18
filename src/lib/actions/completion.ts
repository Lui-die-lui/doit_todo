"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { completionEvents, plans, tasks } from "@/db/schema";
import { decideCompletion } from "@/lib/completion-logic";
import { isUniqueViolation } from "@/lib/db-errors";
import { getSessionUserId } from "@/lib/session";

export type CompleteTaskResult =
  | { ok: true; alreadyDone: boolean }
  | { ok: false; error: "UNAUTHORIZED" | "NOT_FOUND" | "SAVE_FAILED" };

/**
 * Marks a task DONE exactly once per completion cycle, even under duplicate
 * or rapid concurrent requests. The row lock (`FOR UPDATE`) serializes
 * concurrent transactions against the same task, and the UNIQUE constraints
 * on completion_events are the final backstop if two transactions somehow
 * still race past the lock (e.g. retried requests with the same
 * idempotencyKey). A duplicate is never surfaced as an error to the user --
 * it is reported the same as a successful completion.
 */
export async function completeTaskAction(
  taskId: number,
  idempotencyKey: string,
): Promise<CompleteTaskResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ task: tasks })
        .from(tasks)
        .innerJoin(plans, eq(tasks.planId, plans.id))
        .where(and(eq(tasks.id, taskId), eq(plans.userId, userId), isNull(tasks.deletedAt)))
        .for("update");

      if (!row) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }
      const task = row.task;

      const decision = decideCompletion(task);
      if (decision.action === "already_done") {
        return { ok: true as const, alreadyDone: true };
      }

      const now = new Date();
      try {
        await tx.insert(completionEvents).values({
          taskId: task.id,
          completionCycle: decision.nextCycle,
          idempotencyKey,
          completedAt: now,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return { ok: true as const, alreadyDone: true };
        }
        throw err;
      }

      await tx
        .update(tasks)
        .set({
          status: "DONE",
          completedAt: now,
          completionCycle: decision.nextCycle,
          updatedAt: now,
        })
        .where(eq(tasks.id, task.id));

      return { ok: true as const, alreadyDone: false };
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/do");
    revalidatePath("/see");
    revalidatePath("/dashboard");
    return result;
  } catch (err) {
    console.error("completeTaskAction failed", err);
    return { ok: false, error: "SAVE_FAILED" };
  }
}

export type UncompleteTaskResult =
  | { ok: true }
  | { ok: false; error: "UNAUTHORIZED" | "NOT_FOUND" | "SAVE_FAILED" };

/** Reverts a DONE task to TODO. Does not touch completionCycle or past events. */
export async function uncompleteTaskAction(taskId: number): Promise<UncompleteTaskResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  try {
    const [owned] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(plans, eq(tasks.planId, plans.id))
      .where(and(eq(tasks.id, taskId), eq(plans.userId, userId), isNull(tasks.deletedAt)));
    if (!owned) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const [updated] = await db
      .update(tasks)
      .set({ status: "TODO", completedAt: null, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id });

    if (!updated) {
      return { ok: false, error: "NOT_FOUND" };
    }

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/do");
    revalidatePath("/see");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("uncompleteTaskAction failed", err);
    return { ok: false, error: "SAVE_FAILED" };
  }
}
