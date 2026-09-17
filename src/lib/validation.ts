import { z } from "zod";

export const priorityValues = ["HIGH", "MEDIUM", "LOW"] as const;
export const taskStatusValues = ["TODO", "DONE"] as const;

export const priorityLabels: Record<(typeof priorityValues)[number], string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD 여야 합니다.");

const priority = z.enum(priorityValues, { message: "우선순위를 선택하세요." });

export const planInputSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력하세요.").max(200, "제목은 200자 이하여야 합니다."),
    description: z.string().trim().max(5000, "설명은 5000자 이하여야 합니다.").optional().default(""),
    startDate: dateOnly,
    endDate: dateOnly,
    priority,
    successCriteria: z
      .string()
      .trim()
      .min(1, "성공 기준을 입력하세요.")
      .max(2000, "성공 기준은 2000자 이하여야 합니다."),
    estimatedMinutes: z.coerce
      .number({ message: "숫자를 입력하세요." })
      .int("정수만 입력하세요.")
      .min(0, "0 이상이어야 합니다.")
      .max(1_000_000, "너무 큰 값입니다."),
    carriedImprovement: z.string().trim().max(2000).optional().nullable(),
    sourceReflectionId: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
    path: ["endDate"],
  });

export type PlanInput = z.infer<typeof planInputSchema>;

export const planRevisionInputSchema = planInputSchema.and(
  z.object({
    reason: z.string().trim().min(1, "수정 이유를 입력하세요.").max(1000, "수정 이유는 1000자 이하여야 합니다."),
  }),
);

export type PlanRevisionInput = z.infer<typeof planRevisionInputSchema>;

export const taskInputSchema = z.object({
  planId: z.coerce.number({ message: "계획을 선택하세요." }).int().positive(),
  title: z.string().trim().min(1, "제목을 입력하세요.").max(200, "제목은 200자 이하여야 합니다."),
  description: z.string().trim().max(5000, "설명은 5000자 이하여야 합니다.").optional().default(""),
  dueDate: dateOnly,
  priority,
  tag: z.string().trim().max(50, "태그는 50자 이하여야 합니다.").optional().default(""),
  estimatedMinutes: z.coerce
    .number({ message: "숫자를 입력하세요." })
    .int("정수만 입력하세요.")
    .min(0, "0 이상이어야 합니다.")
    .max(1_000_000, "너무 큰 값입니다."),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const workLogInputSchema = z
  .object({
    taskId: z.coerce.number({ message: "할 일을 선택하세요." }).int().positive(),
    startAt: z.string().trim().min(1, "시작 시각을 입력하세요."),
    endAt: z.string().trim().min(1, "종료 시각을 입력하세요."),
    blockerReason: z.string().trim().max(2000, "막힌 이유는 2000자 이하여야 합니다.").optional().nullable(),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.startAt)), {
    message: "시작 시각 형식이 올바르지 않습니다.",
    path: ["startAt"],
  })
  .refine((v) => !Number.isNaN(Date.parse(v.endAt)), {
    message: "종료 시각 형식이 올바르지 않습니다.",
    path: ["endAt"],
  });

export type WorkLogInput = z.infer<typeof workLogInputSchema>;

export const reflectionInputSchema = z.object({
  planId: z.coerce.number({ message: "계획을 선택하세요." }).int().positive(),
  periodStart: dateOnly,
  periodEnd: dateOnly,
  summary: z.string().trim().min(1, "요약을 입력하세요.").max(5000, "요약은 5000자 이하여야 합니다."),
  improvement: z
    .string()
    .trim()
    .min(1, "개선점을 입력하세요.")
    .max(2000, "개선점은 2000자 이하여야 합니다."),
});

export type ReflectionInput = z.infer<typeof reflectionInputSchema>;

export type FieldErrors<T extends Record<string, unknown>> = Partial<Record<keyof T | "_form", string>>;

export function zodErrorToFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError,
): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] as keyof T | undefined) ?? "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
