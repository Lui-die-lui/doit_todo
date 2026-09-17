import { FormField, inputClassName } from "@/components/FormField";

export function HourMinuteField({
  label,
  hoursName,
  minutesName,
  idPrefix,
  defaultHours,
  defaultMinutes,
  hint,
  error,
  required = true,
}: {
  label: string;
  hoursName: string;
  minutesName: string;
  idPrefix: string;
  defaultHours?: number;
  defaultMinutes?: number;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={`${idPrefix}-hours`} required={required} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <input
            id={`${idPrefix}-hours`}
            name={hoursName}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            defaultValue={defaultHours}
            aria-label="시간"
            className={`${inputClassName} w-20 text-right tabular-nums`}
          />
          <span className="text-sm text-ink-500">시간</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            id={`${idPrefix}-minutes`}
            name={minutesName}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            placeholder="0"
            defaultValue={defaultMinutes}
            aria-label="분"
            className={`${inputClassName} w-20 text-right tabular-nums`}
          />
          <span className="text-sm text-ink-500">분</span>
        </div>
      </div>
    </FormField>
  );
}
