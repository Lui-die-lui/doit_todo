"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { plans, reflections } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { GENERIC_SAVE_ERROR } from "@/lib/db-errors";
import { reflectionInputSchema, zodErrorToFieldErrors, type ReflectionInput } from "@/lib/validation";

export async function createReflectionAction(
  prevState: ActionState<keyof ReflectionInput>,
  formData: FormData,
): Promise<ActionState<keyof ReflectionInput>> {
  const parsed = reflectionInputSchema.safeParse({
    planId: formData.get("planId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    summary: formData.get("summary"),
    improvement: formData.get("improvement"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력값을 확인하세요.",
      fieldErrors: zodErrorToFieldErrors(parsed.error),
    };
  }
  if (parsed.data.periodEnd < parsed.data.periodStart) {
    return {
      status: "error",
      message: "기간 종료일은 시작일과 같거나 이후여야 합니다.",
      fieldErrors: { periodEnd: "기간 종료일은 시작일과 같거나 이후여야 합니다." },
    };
  }

  const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, parsed.data.planId));
  if (!plan) {
    return { status: "error", message: "존재하지 않는 계획입니다." };
  }

  let newReflectionId: number;
  try {
    const [inserted] = await db
      .insert(reflections)
      .values({
        planId: parsed.data.planId,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        summary: parsed.data.summary,
        improvement: parsed.data.improvement,
      })
      .returning({ id: reflections.id });
    newReflectionId = inserted.id;
  } catch (err) {
    console.error("createReflectionAction failed", err);
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/see");
  redirect(`/see?planId=${parsed.data.planId}#reflection-${newReflectionId}`);
}
