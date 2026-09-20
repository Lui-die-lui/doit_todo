import { seoulTodayDateString, utcDateToSeoulLocalInput } from "@/lib/date";

/**
 * Pure helpers behind <DateTimePicker>. A picker value is always a plain string --
 * `YYYY-MM-DD` (date only) or `YYYY-MM-DDTHH:mm` (what <input type="datetime-local"> submits) --
 * and is read/written field by field. Nothing here goes through toISOString() or a UTC
 * conversion, so a chosen wall-clock date/time can never drift by a day or by 9 hours;
 * the Asia/Seoul -> UTC conversion stays where it always was (seoulLocalInputToUtcDate, server side).
 */

export type DateParts = { y: number; m: number; d: number };
export type TimeParts = { h: number; min: number };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function isRealDate(y: number, m: number, d: number): boolean {
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseDate(value: string | null | undefined): DateParts | null {
  const match = DATE_RE.exec((value ?? "").trim());
  if (!match) return null;
  const parts = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return isRealDate(parts.y, parts.m, parts.d) ? parts : null;
}

export function parseDateTime(value: string | null | undefined): (DateParts & TimeParts) | null {
  const match = DATETIME_RE.exec((value ?? "").trim());
  if (!match) return null;
  const parts = {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    h: Number(match[4]),
    min: Number(match[5]),
  };
  if (!isRealDate(parts.y, parts.m, parts.d) || parts.h > 23 || parts.min > 59) return null;
  return parts;
}

/** Date part of either format, or null when the value isn't a valid date/datetime. */
export function parseAny(value: string | null | undefined): (DateParts & Partial<TimeParts>) | null {
  return parseDateTime(value) ?? parseDate(value);
}

export function formatDateValue(p: DateParts): string {
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

export function formatDateTimeValue(p: DateParts, t: TimeParts): string {
  return `${formatDateValue(p)}T${pad(t.h)}:${pad(t.min)}`;
}

/** `2026. 09. 20` or `2026. 09. 20 · 14:30`. */
export function formatDisplay(p: DateParts, t?: TimeParts): string {
  const date = `${pad(p.y, 4)}. ${pad(p.m)}. ${pad(p.d)}`;
  return t ? `${date} · ${pad(t.h)}:${pad(t.min)}` : date;
}

/** Local *noon* on the given calendar day: a day-grid Date that stays on the same day in any time zone / DST rule. */
export function toCalendarDate(p: DateParts): Date {
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
}

export function fromCalendarDate(date: Date): DateParts {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 12, 0, 0, 0);
}

/** Clamps free-typed hour/minute text to 0..max; empty / non-numeric falls back to `fallback`. */
export function clampTimeField(text: string, max: number, fallback = 0): number {
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, n));
}

/** Steps an hour/minute value by `delta`, wrapping (23 -> 0, 0 -> 23) without touching the date. */
export function stepTimeField(current: number, delta: number, max: number): number {
  const size = max + 1;
  return (((current + delta) % size) + size) % size;
}

/**
 * min / max may be a date or a datetime. Compared as strings of the value's own format
 * (both zero-padded ISO-like, so lexical order is chronological). A date-only min/max against a
 * datetime value compares the date part; a datetime min/max against a date-only value likewise.
 */
export function isWithinRange(value: string, min?: string, max?: string): boolean {
  if (!value) return true;
  const v = parseAny(value);
  if (!v) return false;
  const key = (s: string, dateOnly: boolean) => (dateOnly ? s.slice(0, 10) : s.slice(0, 16));
  const vDateOnly = value.length <= 10;
  if (min) {
    const bound = key(min, vDateOnly || min.length <= 10);
    const val = key(value, vDateOnly || min.length <= 10);
    if (val < bound) return false;
  }
  if (max) {
    const bound = key(max, vDateOnly || max.length <= 10);
    const val = key(value, vDateOnly || max.length <= 10);
    if (val > bound) return false;
  }
  return true;
}

/** Today in Asia/Seoul (matches every other "today" in the app, whatever the browser's time zone is). */
export function seoulToday(now: Date = new Date()): DateParts {
  return parseDate(seoulTodayDateString(now)) as DateParts;
}

/** Current Asia/Seoul wall-clock date + time. */
export function seoulNow(now: Date = new Date()): DateParts & TimeParts {
  return parseDateTime(utcDateToSeoulLocalInput(now)) as DateParts & TimeParts;
}
