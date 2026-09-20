"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { daysBetweenInclusive, minutesToHm, minutesToLabel } from "@/lib/date";
import { priorityLabels, priorityValues, type PlanInput } from "@/lib/validation";
import { FormField, inputClassName } from "@/components/FormField";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/SubmitButton";
import { PLAN_IMPORT_STORAGE_KEY, parsePlanExportJson } from "@/lib/plan-export";

const PRIORITY_OPTIONS = priorityValues.map((p) => ({ value: p, label: priorityLabels[p] }));

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

  // A plan imported from a JSON file (see PlanExportImport) hands off through sessionStorage
  // rather than the URL, since a plan's success criteria/description can run long. Only
  // "create" reads it -- re-mounting an in-progress edit from a stray import would be
  // surprising. The `key` below forces a fresh mount once it arrives, so these still-uncontrolled
  // inputs pick up their new defaultValue cleanly instead of needing to be poked via refs.
  const [imported, setImported] = useState<Partial<PlanInput> | null>(null);
  useEffect(() => {
    if (mode !== "create") return;
    const raw = sessionStorage.getItem(PLAN_IMPORT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PLAN_IMPORT_STORAGE_KEY);
    const parsed = parsePlanExportJson(raw);
    if (parsed) setImported(parsed);
  }, [mode]);

  const effectiveDefaults = imported ?? defaultValues;

  const [startDate, setStartDate] = useState(effectiveDefaults?.startDate ?? "");
  const [endDate, setEndDate] = useState(effectiveDefaults?.endDate ?? "");
  const days = useMemo(() => daysBetweenInclusive(startDate, endDate), [startDate, endDate]);

  // "하루 총 투입 시간" is the only thing the user edits; the plan's actual
  // estimatedMinutes (what's stored and what every aggregation/constellation
  // calculation reads) is still a single total -- derived here as daily × days and
  // sent through the same hidden estimatedHours/estimatedMinutesPart fields the
  // server action already parses, so nothing downstream needs to change.
  const defaultDaily = useMemo(() => {
    if (effectiveDefaults?.estimatedMinutes === undefined) return { hours: undefined, minutes: undefined };
    const defaultDays = daysBetweenInclusive(effectiveDefaults.startDate ?? "", effectiveDefaults.endDate ?? "") ?? 1;
    return minutesToHm(Math.round(effectiveDefaults.estimatedMinutes / defaultDays));
  }, [effectiveDefaults]);
  const [dailyHours, setDailyHours] = useState<number | "">(defaultDaily.hours ?? "");
  const [dailyMinutes, setDailyMinutes] = useState<number | "">(defaultDaily.minutes ?? "");

  const dailyTotalMinutes = (Number(dailyHours) || 0) * 60 + (Number(dailyMinutes) || 0);
  const totalMinutes = days !== null ? dailyTotalMinutes * days : null;
  const { hours: totalHours, minutes: totalMinutesPart } = minutesToHm(totalMinutes ?? dailyTotalMinutes);

  return (
    <form
      key={imported ? "imported" : "fresh"}
      action={formAction}
      className="flex flex-col gap-6 border border-line bg-surface p-5 sm:p-7"
    >
      {imported && (
        <p className="border border-line-strong bg-surface-muted px-3 py-2 text-sm text-ink-700">
          가져온 계획 데이터로 채워졌습니다. 내용을 확인하고 수정한 뒤 저장하세요.
        </p>
      )}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

      <FormField label="제목" htmlFor="title" required error={errors.title}>
        <input
          id="title"
          name="title"
          defaultValue={effectiveDefaults?.title}
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
          defaultValue={effectiveDefaults?.description ?? ""}
          maxLength={5000}
          rows={4}
          className={`${inputClassName} resize-y`}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="시작일" htmlFor="startDate" required error={errors.startDate}>
          <DateTimePicker id="startDate" name="startDate" dateOnly value={startDate} onChange={setStartDate} required />
        </FormField>
        <FormField label="종료일" htmlFor="endDate" required error={errors.endDate}>
          <DateTimePicker id="endDate" name="endDate" dateOnly value={endDate} onChange={setEndDate} required />
        </FormField>
      </div>

      <FormField label="우선순위" htmlFor="priority" required error={errors.priority}>
        <Select
          id="priority"
          name="priority"
          size="sm"
          defaultValue={effectiveDefaults?.priority ?? "MEDIUM"}
          required
          options={PRIORITY_OPTIONS}
        />
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
          defaultValue={effectiveDefaults?.successCriteria}
          maxLength={2000}
          rows={3}
          required
          placeholder="예: 실전 모의고사 3회 평균 70점 이상"
          className={`${inputClassName} resize-y`}
        />
      </FormField>

      <FormField
        label="하루 총 투입 시간"
        htmlFor="plan-daily-estimated-hours"
        required
        error={errors.estimatedMinutes}
        hint="하루에 이 계획에 쓸 것으로 예상하는 시간 -- 총 예상 투입 시간은 계획 기간에 맞춰 자동 계산됩니다"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <input
              id="plan-daily-estimated-hours"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value === "" ? "" : Number(e.target.value))}
              aria-label="하루 시간"
              className={`${inputClassName} !w-20 shrink-0 text-right tabular-nums`}
            />
            <span className="text-sm text-ink-500">시간</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              id="plan-daily-estimated-minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              placeholder="0"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(e.target.value === "" ? "" : Number(e.target.value))}
              aria-label="하루 분"
              className={`${inputClassName} !w-20 shrink-0 text-right tabular-nums`}
            />
            <span className="text-sm text-ink-500">분</span>
          </div>
        </div>
      </FormField>

      <div className="flex items-center justify-between border border-line-strong bg-surface-muted px-4 py-3">
        <span className="label-coord text-[10px] text-ink-400">
          총 예상 투입 시간{days !== null ? ` (${days}일 × 하루 ${minutesToLabel(dailyTotalMinutes)})` : " (시작일·종료일을 입력하면 계산됩니다)"}
        </span>
        <span className="font-mono text-sm font-semibold text-ink-900">
          {totalMinutes !== null ? minutesToLabel(totalMinutes) : "—"}
        </span>
      </div>
      <input type="hidden" name="estimatedHours" value={totalHours} />
      <input type="hidden" name="estimatedMinutesPart" value={totalMinutesPart} />

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
            defaultValue={effectiveDefaults?.carriedImprovement ?? ""}
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

      <div className="flex justify-end">
        <SubmitButton>{mode === "create" ? "계획 만들기" : "수정 저장"}</SubmitButton>
      </div>
    </form>
  );
}
