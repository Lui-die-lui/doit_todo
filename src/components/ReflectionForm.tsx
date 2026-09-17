"use client";

import { useActionState } from "react";
import { createReflectionAction } from "@/lib/actions/reflections";
import { FormField, inputClassName } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";

export function ReflectionForm({
  plans,
  defaultPlanId,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  plans: { id: number; title: string }[];
  defaultPlanId?: number;
  defaultPeriodStart?: string;
  defaultPeriodEnd?: string;
}) {
  const [state, formAction] = useActionState(createReflectionAction, { status: "idle" });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5 border border-line bg-surface p-5 sm:p-7">
      <h2 className="label-coord text-[11px] text-ink-500">SEE / LOG ENTRY — 돌아보기 작성</h2>

      <FormField label="계획" htmlFor="reflection-planId" required error={errors.planId as string | undefined}>
        <select id="reflection-planId" name="planId" defaultValue={defaultPlanId ?? ""} required className={inputClassName}>
          <option value="" disabled>
            계획을 선택하세요
          </option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="기간 시작" htmlFor="periodStart" required error={errors.periodStart as string | undefined}>
          <input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={defaultPeriodStart}
            required
            className={inputClassName}
          />
        </FormField>
        <FormField label="기간 종료" htmlFor="periodEnd" required error={errors.periodEnd as string | undefined}>
          <input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={defaultPeriodEnd}
            required
            className={inputClassName}
          />
        </FormField>
      </div>

      <FormField
        label="잘된 점 · 요약"
        htmlFor="summary"
        required
        error={errors.summary as string | undefined}
        hint="이번 기간 동안 잘된 점과 전반적인 진행 상황을 요약합니다."
      >
        <textarea id="summary" name="summary" rows={3} maxLength={5000} required className={`${inputClassName} resize-y`} />
      </FormField>

      <FormField
        label="다음 계획에서 고칠 점"
        htmlFor="improvement"
        required
        error={errors.improvement as string | undefined}
        hint="다음 계획으로 넘길 개선점 한 가지"
      >
        <textarea id="improvement" name="improvement" rows={2} maxLength={2000} required className={`${inputClassName} resize-y`} />
      </FormField>

      {state.status === "error" && state.message && (
        <p role="alert" className="border border-ink-900 bg-surface-muted px-3 py-2 text-sm text-ink-900">
          {state.message}
        </p>
      )}

      <div>
        <SubmitButton>돌아보기 저장</SubmitButton>
      </div>
    </form>
  );
}
