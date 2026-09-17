"use client";

import { useActionState } from "react";
import { createWorkLogAction } from "@/lib/actions/worklogs";
import type { WorkLogInput } from "@/lib/validation";
import { FormField, inputClassName } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";

export function WorkLogForm({
  tasksByPlan,
  defaultTaskId,
}: {
  tasksByPlan: { planTitle: string; tasks: { id: number; title: string }[] }[];
  defaultTaskId?: number;
}) {
  const [state, formAction] = useActionState(createWorkLogAction, { status: "idle" });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5 border border-line bg-surface p-5 sm:p-7">
      <h2 className="label-coord text-[11px] text-ink-500">DO / NEW ENTRY — 실행 기록 추가</h2>

      <FormField label="할 일" htmlFor="taskId" required error={errors.taskId as string | undefined}>
        <select id="taskId" name="taskId" defaultValue={defaultTaskId ?? ""} required className={inputClassName}>
          <option value="" disabled>
            할 일을 선택하세요
          </option>
          {tasksByPlan.map((group) => (
            <optgroup key={group.planTitle} label={group.planTitle}>
              {group.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="시작 시각" htmlFor="startAt" required error={errors.startAt as string | undefined}>
          <input id="startAt" name="startAt" type="datetime-local" required className={inputClassName} />
        </FormField>
        <FormField label="종료 시각" htmlFor="endAt" required error={errors.endAt as string | undefined}>
          <input id="endAt" name="endAt" type="datetime-local" required className={inputClassName} />
        </FormField>
      </div>

      <FormField
        label="막힌 이유"
        htmlFor="blockerReason"
        required={false}
        error={errors.blockerReason as string | undefined}
        hint="막힌 점이 없었다면 비워두세요."
      >
        <textarea id="blockerReason" name="blockerReason" rows={2} maxLength={2000} className={`${inputClassName} resize-y`} />
      </FormField>

      {state.status === "error" && state.message && (
        <p role="alert" className="border border-ink-900 bg-surface-muted px-3 py-2 text-sm text-ink-900">
          {state.message}
        </p>
      )}

      <div>
        <SubmitButton>기록 저장</SubmitButton>
      </div>
    </form>
  );
}

export type { WorkLogInput };
