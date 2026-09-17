"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tasks, workLogs } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { computeActualMinutes, seoulLocalInputToUtcDate } from "@/lib/date";
import { GENERIC_SAVE_ERROR } from "@/lib/db-errors";
import { workLogInputSchema, zodErrorToFieldErrors, type WorkLogInput } from "@/lib/validation";

export async function createWorkLogAction(
  prevState: ActionState<keyof WorkLogInput>,
  formData: FormData,
): Promise<ActionState<keyof WorkLogInput>> {
  const parsed = workLogInputSchema.safeParse({
    taskId: formData.get("taskId"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    blockerReason: formData.get("blockerReason") || null,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }

  const startAtUtc = seoulLocalInputToUtcDate(parsed.data.startAt) ?? new Date(parsed.data.startAt);
  const endAtUtc = seoulLocalInputToUtcDate(parsed.data.endAt) ?? new Date(parsed.data.endAt);

  if (endAtUtc.getTime() < startAtUtc.getTime()) {
    return {
      status: "error",
      message: "종료 시각은 시작 시각보다 빠를 수 없습니다.",
      fieldErrors: { endAt: "종료 시각은 시작 시각보다 빠를 수 없습니다." },
    };
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, parsed.data.taskId), isNull(tasks.deletedAt)));
  if (!task) {
    return { status: "error", message: "존재하지 않거나 삭제된 할 일입니다." };
  }

  const actualMinutes = computeActualMinutes(startAtUtc, endAtUtc);

  try {
    await db.insert(workLogs).values({
      taskId: parsed.data.taskId,
      startAt: startAtUtc,
      endAt: endAtUtc,
      actualMinutes,
      blockerReason: parsed.data.blockerReason || null,
    });
  } catch (err) {
    console.error("createWorkLogAction failed", err);
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/do");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  revalidatePath("/see");
  redirect(`/do?taskId=${parsed.data.taskId}`);
}
