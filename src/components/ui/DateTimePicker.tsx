"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import { Select } from "@/components/ui/Select";
import {
  clampTimeField,
  formatDateTimeValue,
  formatDateValue,
  formatDisplay,
  fromCalendarDate,
  isWithinRange,
  parseAny,
  parseDate,
  seoulNow,
  seoulToday,
  shiftMonth,
  stepTimeField,
  toCalendarDate,
  type DateParts,
} from "@/lib/date-picker";

/**
 * Custom date / date+time field that replaces <input type="date"> and <input type="datetime-local">.
 *
 * Form contract: the picked value is submitted under `name` as a plain string --
 * `YYYY-MM-DD` (dateOnly) or `YYYY-MM-DDTHH:mm` (what datetime-local submitted), i.e. the user's
 * Asia/Seoul wall-clock time with no zone conversion. The server keeps doing the Seoul -> UTC
 * step exactly as before. A visually hidden text input carries name/value/required so native
 * form validation and FormData behave like the input it replaces.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`) -- never mixed.
 * Edits are drafted inside the popover and only committed by "적용".
 */
export type DateTimePickerProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Date-only mode: value is `YYYY-MM-DD`, no time controls. */
  dateOnly?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Earliest / latest allowed value, as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  min?: string;
  max?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

type Draft = { date: DateParts | null; hour: string; minute: string };

const pad2 = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = "일월화수목금토";
const QUICK_TIMES = [
  { h: 9, min: 0 },
  { h: 12, min: 0 },
  { h: 18, min: 0 },
];

// Sunday-first, like the native calendar this replaces (and Korean calendars generally).
const WEEK_STARTS_ON = 0;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink-900";

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="11" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function ArrowIcon({
  direction,
}: {
  direction: "left" | "right" | "up" | "down";
}) {
  const path = {
    left: "M9 3 4.5 7.5 9 12",
    right: "M6 3l4.5 4.5L6 12",
    up: "M3 8.5 6 5.5l3 3",
    down: "M3 4.5l3 3 3-3",
  }[direction];
  const size = direction === "left" || direction === "right" ? 15 : 12;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={
        direction === "left" || direction === "right"
          ? "0 0 15 15"
          : "0 0 12 12"
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex h-10 items-center justify-center px-4 text-sm transition-colors disabled:cursor-not-allowed " +
        (variant === "primary"
          ? "bg-ink-900 font-medium text-white hover:opacity-90 disabled:opacity-40 "
          : "border border-line-strong bg-transparent text-ink-700 hover:border-ink-900 hover:text-ink-900 disabled:opacity-40 ") +
        FOCUS_RING
      }
    >
      {children}
    </button>
  );
}

function TimeField({
  label,
  max,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  max: number;
  value: string;
  onChange: (next: string) => void;
  onEnter: () => void;
}) {
  const current = clampTimeField(value, max);
  const step = (delta: number) =>
    onChange(pad2(stepTimeField(current, delta, max)));
  return (
    <div className="flex h-[42px] w-[72px] border border-line-strong bg-surface transition-colors focus-within:border-ink-900 focus-within:outline focus-within:outline-1 focus-within:outline-offset-2 focus-within:outline-ink-900 hover:border-ink-900">
      <input
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 2))
        }
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => onChange(pad2(clampTimeField(value, max)))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          } else if (e.key === "PageUp") {
            e.preventDefault();
            step(10);
          } else if (e.key === "PageDown") {
            e.preventDefault();
            step(-10);
          } else if (e.key === "Home") {
            e.preventDefault();
            onChange("00");
          } else if (e.key === "End") {
            e.preventDefault();
            onChange(pad2(max));
          } else if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-left font-mono text-sm tabular-nums text-ink-900 outline-none focus-visible:outline-none [@media(pointer:fine)]:pr-1"
      />
      {/* Mouse-only affordance: on touch screens the 42px field takes numeric-keypad input directly. */}
      <div className="hidden w-6 shrink-0 flex-col border-l border-line [@media(pointer:fine)]:flex">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${label} 증가`}
          onClick={() => step(1)}
          className="flex h-1/2 items-center justify-center text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900"
        >
          <ArrowIcon direction="up" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${label} 감소`}
          onClick={() => step(-1)}
          className="flex h-1/2 items-center justify-center border-t border-line text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900"
        >
          <ArrowIcon direction="down" />
        </button>
      </div>
    </div>
  );
}

export function DateTimePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  dateOnly = false,
  placeholder,
  required,
  disabled,
  min,
  max,
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = isControlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    date: null,
    hour: "00",
    minute: "00",
  });
  const [view, setView] = useState<Date>(() =>
    toCalendarDate({ y: 2000, m: 1, d: 1 }),
  );
  const [today, setToday] = useState<Date>(() =>
    toCalendarDate({ y: 2000, m: 1, d: 1 }),
  );
  const [rangeError, setRangeError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // When neither side of the field has room for the whole panel (a field mid-page on a short
  // screen), the panel docks to the centre of the screen instead of scrolling inside itself.
  const [docked, setDocked] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const parsed = parseAny(current);
  const display = parsed
    ? formatDisplay(
        parsed,
        !dateOnly && parsed.h !== undefined
          ? { h: parsed.h, min: parsed.min as number }
          : undefined,
      )
    : current;
  const resolvedPlaceholder =
    placeholder ??
    (dateOnly ? "날짜를 선택하세요" : "날짜와 시간을 선택하세요");

  // Native-like validation lives on the hidden input: `required` for empty, custom validity for
  // malformed / out-of-range values.
  useEffect(() => {
    const el = hiddenRef.current;
    if (!el) return;
    if (current && !parsed)
      el.setCustomValidity("올바른 날짜 형식이 아닙니다.");
    else if (current && !isWithinRange(current, min, max))
      el.setCustomValidity("허용된 범위를 벗어난 값입니다.");
    else el.setCustomValidity("");
  }, [current, parsed, min, max]);

  // form.reset() (React 19 resets uncontrolled fields after a form action) puts an uncontrolled
  // picker back to its default, like the native input it replaces.
  useEffect(() => {
    if (isControlled) return;
    const form = hiddenRef.current?.form;
    if (!form) return;
    const reset = () => setInner(defaultValue ?? "");
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [isControlled, defaultValue]);

  useEffect(() => {
    if (!open) setDocked(false);
  }, [open]);

  // Radix mounts the portal'd content one render after `open` flips, so measure from a callback ref
  // (runs when the node attaches, before paint) rather than from an effect on `open`.
  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    const trigger = triggerRef.current;
    if (!node || !trigger || window.innerWidth < 640) return;
    const body = node.firstElementChild as HTMLElement | null;
    const footer = node.lastElementChild as HTMLElement | null;
    if (!body || !footer) return;
    const needed = body.scrollHeight + footer.offsetHeight + 2;
    const rect = trigger.getBoundingClientRect();
    const room = Math.max(window.innerHeight - rect.bottom, rect.top) - 6 - 16;
    setDocked(needed > room);
  }, []);

  function commit(next: string) {
    if (!isControlled) setInner(next);
    onChange?.(next);
    setInvalid(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const now = seoulNow();
      const base = parsed ?? now;
      const date = parsed ? { y: parsed.y, m: parsed.m, d: parsed.d } : null;
      setToday(toCalendarDate(seoulToday()));
      setDraft({
        date,
        hour: pad2(parsed?.h ?? now.h),
        minute: pad2(parsed?.min ?? now.min),
      });
      setView(toCalendarDate({ y: base.y, m: base.m, d: 1 }));
      setRangeError(false);
    }
    setOpen(next);
  }

  function apply(dateOverride?: DateParts) {
    const date = dateOverride ?? draft.date;
    if (!date) return;
    const next = dateOnly
      ? formatDateValue(date)
      : formatDateTimeValue(date, {
          h: clampTimeField(draft.hour, 23),
          min: clampTimeField(draft.minute, 59),
        });
    if (!isWithinRange(next, min, max)) {
      setRangeError(true);
      return;
    }
    commit(next);
    setOpen(false);
  }

  function pickDay(date: DateParts) {
    const same =
      draft.date &&
      draft.date.y === date.y &&
      draft.date.m === date.m &&
      draft.date.d === date.d;
    setRangeError(false);
    setView(toCalendarDate({ y: date.y, m: date.m, d: 1 }));
    // Date-only pickers: choosing the already-chosen day again confirms it.
    if (dateOnly && same) {
      apply(date);
      return;
    }
    setDraft((p) => ({ ...p, date }));
  }

  function setTime(h: number, min: number) {
    setRangeError(false);
    setDraft((p) => ({ ...p, hour: pad2(h), minute: pad2(min) }));
  }

  const viewYear = view.getFullYear();
  const viewMonth = view.getMonth();
  const minDate = parseDate((min ?? "").slice(0, 10));
  const maxDate = parseDate((max ?? "").slice(0, 10));
  const disabledDays = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) matchers.push({ before: toCalendarDate(minDate) });
    if (maxDate) matchers.push({ after: toCalendarDate(maxDate) });
    return matchers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  const yearOptions = useMemo(() => {
    const base = seoulToday().y;
    const years = new Set<number>();
    const from = minDate ? minDate.y : Math.min(base - 5, viewYear);
    const to = maxDate ? maxDate.y : Math.max(base + 10, viewYear);
    for (let y = from; y <= to; y++) years.add(y);
    years.add(viewYear);
    return [...years]
      .sort((a, b) => a - b)
      .map((y) => ({ value: String(y), label: String(y) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, min, max]);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: pad2(i + 1),
      })),
    [],
  );

  const summary = draft.date
    ? formatDisplay(
        draft.date,
        dateOnly
          ? undefined
          : {
              h: clampTimeField(draft.hour, 23),
              min: clampTimeField(draft.minute, 59),
            },
      )
    : "—";
  const isInvalid = ariaInvalid || invalid;

  return (
    <div className={`relative w-full ${className}`}>
      <Popover.Root modal open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            data-invalid={isInvalid || undefined}
            data-placeholder={display ? undefined : ""}
            className={
              "group flex h-[42px] w-full cursor-pointer items-center justify-between gap-3 border border-line-strong bg-surface px-3.5 text-left text-sm text-ink-900 " +
              "transition-colors duration-150 hover:border-ink-900 data-[state=open]:border-ink-900 " +
              "data-[placeholder]:text-ink-400 data-[invalid]:border-ink-900 " +
              "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted disabled:text-ink-400 disabled:hover:border-line " +
              FOCUS_RING
            }
          >
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {display || resolvedPlaceholder}
            </span>
            <span className="inline-flex shrink-0 text-ink-500 group-disabled:text-ink-400">
              <CalendarIcon />
            </span>
          </button>
        </Popover.Trigger>

        {/* Carries name / value / required into the form (see the note at the top of the file). */}
        <input
          ref={hiddenRef}
          type="text"
          name={name}
          value={current}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          onInvalid={() => setInvalid(true)}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
        />

        <Popover.Portal>
          <Popover.Content
            ref={setContentNode}
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            data-docked={docked || undefined}
            aria-label={dateOnly ? "날짜 선택" : "날짜와 시간 선택"}
            onOpenAutoFocus={(e) => {
              // Put focus on the day grid (selected day, else today) instead of the first button.
              e.preventDefault();
              requestAnimationFrame(() => {
                const root = contentRef.current;
                const target =
                  root?.querySelector<HTMLElement>('td button[tabindex="0"]') ??
                  root?.querySelector<HTMLElement>("td button:not([disabled])");
                target?.focus();
              });
            }}
            className="doit-picker-content z-[100] flex max-h-[var(--radix-popover-content-available-height)] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden data-[docked]:max-h-[calc(100dvh-32px)] max-sm:max-h-[calc(100dvh-32px)] border border-[#1a1a1a] bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.09)] outline-none"
          >
            {/* The body scrolls on short screens; the summary + action row below it stays pinned. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-coord text-[10px] text-ink-400">
                    OBSERVATION DATE
                  </p>
                  <div className="-ml-2 mt-1 flex items-center">
                    <Select
                      variant="inline"
                      size="auto"
                      aria-label="연도"
                      value={String(viewYear)}
                      onValueChange={(v) =>
                        setView(
                          toCalendarDate({
                            y: Number(v),
                            m: viewMonth + 1,
                            d: 1,
                          }),
                        )
                      }
                      options={yearOptions}
                    />
                    <span
                      aria-hidden="true"
                      className="font-mono text-sm text-ink-400"
                    >
                      /
                    </span>
                    <Select
                      variant="inline"
                      size="auto"
                      aria-label="월"
                      value={String(viewMonth + 1)}
                      onValueChange={(v) =>
                        setView(
                          toCalendarDate({ y: viewYear, m: Number(v), d: 1 }),
                        )
                      }
                      options={monthOptions}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    aria-label="이전 달"
                    onClick={() => setView((v) => shiftMonth(v, -1))}
                    className={`inline-flex h-10 w-10 items-center justify-center border border-line-strong text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 ${FOCUS_RING}`}
                  >
                    <ArrowIcon direction="left" />
                  </button>
                  <button
                    type="button"
                    aria-label="다음 달"
                    onClick={() => setView((v) => shiftMonth(v, 1))}
                    className={`inline-flex h-10 w-10 items-center justify-center border border-line-strong text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 ${FOCUS_RING}`}
                  >
                    <ArrowIcon direction="right" />
                  </button>
                </div>
              </div>

              <DayPicker
                mode="single"
                required
                locale={ko}
                weekStartsOn={WEEK_STARTS_ON}
                month={view}
                onMonthChange={setView}
                selected={draft.date ? toCalendarDate(draft.date) : undefined}
                onSelect={(d) => d && pickDay(fromCalendarDate(d))}
                today={today}
                disabled={disabledDays}
                hideNavigation
                showOutsideDays
                fixedWeeks
                animate={false}
                formatters={{ formatWeekdayName: (d) => WEEKDAYS[d.getDay()] }}
                labels={{
                  labelGrid: (d) =>
                    `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
                  labelWeekday: (d) => `${WEEKDAYS[d.getDay()]}요일`,
                  labelDayButton: (d, m) =>
                    `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일${m.today ? ", 오늘" : ""}${m.selected ? ", 선택됨" : ""}`,
                }}
                className="doit-cal mt-3"
                classNames={{
                  root: "w-full",
                  months: "w-full",
                  month: "w-full",
                  month_caption: "sr-only",
                  month_grid: "w-full table-fixed border-collapse",
                  weekday:
                    "h-7 text-center text-[11px] font-normal text-ink-400",
                  day: "group p-0 text-center",
                  day_button:
                    "relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center border border-transparent bg-transparent text-sm tabular-nums text-ink-900 transition-colors " +
                    "hover:border-ink-900 hover:bg-surface-muted focus-visible:border-ink-900 focus-visible:bg-surface-muted focus-visible:outline-none " +
                    "group-data-[outside=true]:opacity-40 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-25 " +
                    "group-data-[selected=true]:border-ink-900 group-data-[selected=true]:bg-ink-900 group-data-[selected=true]:text-white group-data-[selected=true]:opacity-100",
                }}
              />

              {!dateOnly && (
                <div
                  role="group"
                  aria-label="시간"
                  className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-line pt-3"
                >
                  <span className="label-coord text-[10px] text-ink-400">
                    TIME
                  </span>
                  <div className="flex items-center gap-2">
                    <TimeField
                      label="시"
                      max={23}
                      value={draft.hour}
                      onChange={(v) => {
                        setRangeError(false);
                        setDraft((p) => ({ ...p, hour: v }));
                      }}
                      onEnter={() => apply()}
                    />
                    <span
                      aria-hidden="true"
                      className="font-mono text-sm text-ink-500"
                    >
                      :
                    </span>
                    <TimeField
                      label="분"
                      max={59}
                      value={draft.minute}
                      onChange={(v) => {
                        setRangeError(false);
                        setDraft((p) => ({ ...p, minute: v }));
                      }}
                      onEnter={() => apply()}
                    />
                  </div>
                  <div className="flex gap-1.5 sm:ml-auto">
                    {QUICK_TIMES.map((t) => (
                      <button
                        key={`${t.h}:${t.min}`}
                        type="button"
                        onClick={() => setTime(t.h, t.min)}
                        className={`inline-flex h-10 items-center border border-line-strong px-2.5 font-mono text-xs tabular-nums text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 ${FOCUS_RING}`}
                      >
                        {pad2(t.h)}:{pad2(t.min)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-line px-5 pb-5 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="label-coord text-[10px] text-ink-400">
                  SELECTED ORBIT
                </span>
                <span
                  aria-live="polite"
                  className="font-mono text-xs tabular-nums text-ink-900"
                >
                  {summary}
                </span>
              </div>
              {rangeError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-ink-900"
                >
                  <span aria-hidden="true">▲ </span>허용된 범위를 벗어난
                  값입니다.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <ActionButton
                    onClick={() => {
                      const t = seoulToday();
                      setRangeError(false);
                      setDraft((p) => ({ ...p, date: t }));
                      setView(toCalendarDate({ y: t.y, m: t.m, d: 1 }));
                    }}
                  >
                    오늘
                  </ActionButton>
                  {!dateOnly && (
                    <ActionButton
                      onClick={() => {
                        const n = seoulNow();
                        setRangeError(false);
                        setDraft({
                          date: { y: n.y, m: n.m, d: n.d },
                          hour: pad2(n.h),
                          minute: pad2(n.min),
                        });
                        setView(toCalendarDate({ y: n.y, m: n.m, d: 1 }));
                      }}
                    >
                      지금
                    </ActionButton>
                  )}
                </div>
                <div className="flex gap-2">
                  <ActionButton onClick={() => setOpen(false)}>
                    취소
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    disabled={!draft.date}
                    onClick={() => apply()}
                  >
                    적용
                  </ActionButton>
                </div>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
