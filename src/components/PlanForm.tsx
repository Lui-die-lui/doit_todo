"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { minutesToHm } from "@/lib/date";
import { priorityLabels, priorityValues, type PlanInput } from "@/lib/validation";
import { FormField, inputClassName } from "@/components/FormField";
import { HourMinuteField } from "@/components/HourMinuteField";
import { SubmitButton } from "@/components/SubmitButton";

type PlanFormAction = (
  prevState: ActionState<keyof PlanInput | "reason">,
  formData: FormData,
) => Promise<ActionState<keyof PlanInput | "reason">>;

export function PlanForm({
  action,
  defaultValues,
  mode,
  hiddenFields,
}: {
  action: PlanFormAction;
  defaultValues?: Partial<PlanInput>;
  mode: "create" | "edit";
  hiddenFields?: Record<string, string | number>;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  const errors = state.fieldErrors ?? {};
  const { hours: defaultHours, minutes: defaultMinutesPart } = minutesToHm(defaultValues?.estimatedMinutes);

  return (
    <form action={formAction} className="flex flex-col gap-6 border border-line bg-surface p-5 sm:p-7">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

      <FormField label="제목" htmlFor="title" required error={errors.title}>
        <input
          id="title"
          name="title"
          defaultValue={defaultValues?.title}
          maxLength={200}
          required
          placeholder="예: 정보처리기사 실기 재도전 준비"
          className={inputClassName}
        />
      </FormField>

      <FormField label="설명" htmlFor="description" error={errors.description} required={false}>
        <textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          maxLength={5000}
          rows={4}
          className={`${inputClassName} resize-y`}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="시작일" htmlFor="startDate" required error={errors.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={defaultValues?.startDate}
            required
            className={inputClassName}
          />
        </FormField>
        <FormField label="종료일" htmlFor="endDate" required error={errors.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={defaultValues?.endDate}
            required
            className={inputClassName}
          />
        </FormField>
      </div>

      <FormField label="우선순위" htmlFor="priority" required error={errors.priority}>
        <select
          id="priority"
          name="priority"
          defaultValue={defaultValues?.priority ?? "MEDIUM"}
          required
          className={inputClassName}
        >
          {priorityValues.map((p) => (
            <option key={p} value={p}>
              {priorityLabels[p]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="성공 기준"
        htmlFor="successCriteria"
        required
        error={errors.successCriteria}
        hint="이 계획이 성공했다고 말할 수 있는 구체적인 기준"
      >
        <textarea
          id="successCriteria"
          name="successCriteria"
          defaultValue={defaultValues?.successCriteria}
          maxLength={2000}
          rows={3}
          required
          placeholder="예: 실전 모의고사 3회 평균 70점 이상"
          className={`${inputClassName} resize-y`}
        />
      </FormField>

      <HourMinuteField
        label="예상 총 투입 시간"
        idPrefix="plan-estimated"
        hoursName="estimatedHours"
        minutesName="estimatedMinutesPart"
        defaultHours={defaultValues?.estimatedMinutes !== undefined ? defaultHours : undefined}
        defaultMinutes={defaultValues?.estimatedMinutes !== undefined ? defaultMinutesPart : undefined}
        hint="이 계획을 완료하는 데 실제로 투입할 것으로 예상하는 시간"
        error={errors.estimatedMinutes}
      />

      {mode === "create" && (
        <FormField
          label="이어받은 개선점"
          htmlFor="carriedImprovement"
          error={errors.carriedImprovement}
          required={false}
        >
          <textarea
            id="carriedImprovement"
            name="carriedImprovement"
            defaultValue={defaultValues?.carriedImprovement ?? ""}
            maxLength={2000}
            rows={2}
            placeholder="이전 돌아보기에서 넘어온 개선점입니다. 없다면 비워두세요."
            className={`${inputClassName} resize-y`}
          />
        </FormField>
      )}

      {mode === "edit" && (
        <FormField
          label="수정 이유"
          htmlFor="reason"
          required
          error={errors.reason}
          hint="이 계획을 왜 수정하는지 기록하면 수정 이력에 남습니다."
        >
          <textarea id="reason" name="reason" rows={2} maxLength={1000} required className={`${inputClassName} resize-y`} />
        </FormField>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="border border-ink-900 bg-surface-muted px-3 py-2 text-sm text-ink-900">
          {state.message}
        </p>
      )}

      <div>
        <SubmitButton>{mode === "create" ? "계획 만들기" : "수정 저장"}</SubmitButton>
      </div>
    </form>
  );
}
