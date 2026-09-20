"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { minutesToHm } from "@/lib/date";
import { priorityLabels, priorityValues, type TaskInput } from "@/lib/validation";
import { FormField, inputClassName } from "@/components/FormField";
import { HourMinuteField } from "@/components/HourMinuteField";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/SubmitButton";

const PRIORITY_OPTIONS = priorityValues.map((p) => ({ value: p, label: priorityLabels[p] }));

type TaskFormAction = (
  prevState: ActionState<keyof TaskInput>,
  formData: FormData,
) => Promise<ActionState<keyof TaskInput>>;

export function TaskForm({
  action,
  defaultValues,
  mode,
  plans,
}: {
  action: TaskFormAction;
  defaultValues?: Partial<TaskInput>;
  mode: "create" | "edit";
  plans: { id: number; title: string }[];
}) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  const errors = state.fieldErrors ?? {};
  const { hours: defaultHours, minutes: defaultMinutesPart } = minutesToHm(defaultValues?.estimatedMinutes);

  return (
    <form action={formAction} className="flex flex-col gap-6 border border-line bg-surface p-5 sm:p-7">
      <FormField label="계획" htmlFor="planId" required error={errors.planId}>
        <Select
          id="planId"
          name="planId"
          size="full"
          defaultValue={defaultValues?.planId ? String(defaultValues.planId) : ""}
          required
          placeholder="계획을 선택하세요"
          options={plans.map((p) => ({ value: String(p.id), label: p.title }))}
        />
      </FormField>

      <FormField label="제목" htmlFor="title" required error={errors.title}>
        <input
          id="title"
          name="title"
          defaultValue={defaultValues?.title}
          maxLength={200}
          required
          placeholder="예: C 포인터·배열·비트 연산 문제 복습"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="마감일" htmlFor="dueDate" required error={errors.dueDate}>
          <DateTimePicker id="dueDate" name="dueDate" dateOnly defaultValue={defaultValues?.dueDate} required />
        </FormField>
        <FormField label="우선순위" htmlFor="priority" required error={errors.priority}>
          <Select
            id="priority"
            name="priority"
            size="full"
            defaultValue={defaultValues?.priority ?? "MEDIUM"}
            required
            options={PRIORITY_OPTIONS}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="태그" htmlFor="tag" error={errors.tag} required={false} hint="예: 이론, 실기, 복습">
          <input
            id="tag"
            name="tag"
            defaultValue={defaultValues?.tag ?? ""}
            maxLength={50}
            placeholder="이론"
            className={inputClassName}
          />
        </FormField>
        <HourMinuteField
          label="예상 소요 시간"
          idPrefix="task-estimated"
          hoursName="estimatedHours"
          minutesName="estimatedMinutesPart"
          defaultHours={defaultValues?.estimatedMinutes !== undefined ? defaultHours : undefined}
          defaultMinutes={defaultValues?.estimatedMinutes !== undefined ? defaultMinutesPart : undefined}
          error={errors.estimatedMinutes}
        />
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="border border-ink-900 bg-surface-muted px-3 py-2 text-sm text-ink-900">
          {state.message}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton>{mode === "create" ? "할 일 추가" : "수정 저장"}</SubmitButton>
      </div>
    </form>
  );
}
