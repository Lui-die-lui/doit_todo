export const SEOUL_TIME_ZONE = "Asia/Seoul";

/** Today's calendar date in Asia/Seoul as YYYY-MM-DD (independent of server TZ). */
export function seoulTodayDateString(referenceDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

/** True when a task counts as overdue: not deleted (caller filters), not DONE, and due date has passed in Seoul time. */
export function isOverdue(
  dueDate: string,
  status: "TODO" | "DONE",
  today: string = seoulTodayDateString(),
): boolean {
  return status !== "DONE" && dueDate < today;
}

/** Formats a UTC timestamp for display in Asia/Seoul as "YYYY-MM-DD HH:mm". */
export function formatDateTimeSeoul(input: Date | string | null | undefined): string {
  if (!input) return "-";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "-";
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return formatted.replace(",", "");
}

/** Formats a plain date column (YYYY-MM-DD) as "YYYY.MM.DD" for display. */
export function formatDateOnly(input: string | null | undefined): string {
  if (!input) return "-";
  return input.replaceAll("-", ".");
}

/** Inclusive day count between two YYYY-MM-DD dates (same day -> 1). Null on invalid/
 * out-of-order input -- the plan form falls back to a 1-day estimate in that case. */
export function daysBetweenInclusive(startDate: string, endDate: string): number | null {
  const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_ONLY_RE.test(startDate) || !DATE_ONLY_RE.test(endDate)) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Converts a `datetime-local` input value (assumed Seoul wall-clock) to a UTC Date. */
export function seoulLocalInputToUtcDate(localValue: string): Date | null {
  if (!localValue) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const asUtcGuess = new Date(`${y}-${mo}-${d}T${h}:${mi}:00.000Z`);
  const offsetMinutes = getSeoulOffsetMinutes(asUtcGuess);
  return new Date(asUtcGuess.getTime() - offsetMinutes * 60_000);
}

function getSeoulOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - date.getTime()) / 60_000;
}

/** Converts a UTC Date to a `datetime-local` input value in Seoul wall-clock time. */
export function utcDateToSeoulLocalInput(input: Date | string | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function computeActualMinutes(startAt: Date, endAt: Date): number {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}

/** Splits a total-minutes integer into whole hours + remaining minutes, for hour/minute input fields. */
export function minutesToHm(totalMinutes: number | null | undefined): { hours: number; minutes: number } {
  const safe = Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes as number)) : 0;
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/** Combines separate hour/minute input values into a total-minutes integer. Returns NaN if invalid (caught by zod's number check downstream). */
export function hmToMinutes(hoursInput: FormDataEntryValue | null, minutesInput: FormDataEntryValue | null): number {
  const hours = hoursInput === null || hoursInput === "" ? 0 : Number(hoursInput);
  const minutes = minutesInput === null || minutesInput === "" ? 0 : Number(minutesInput);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return NaN;
  }
  return Math.round(hours) * 60 + Math.round(minutes);
}

/** Coordinate-style mono label, e.g. 510 -> "08H 30M". Used only for small secondary labels. */
export function minutesToMonoLabel(totalMinutes: number): string {
  const { hours, minutes } = minutesToHm(totalMinutes);
  return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M`;
}

/** Formats a minute count as "N시간 M분" (Korean, compact). */
export function minutesToLabel(totalMinutes: number): string {
  const safe = Number.isFinite(totalMinutes) ? Math.round(totalMinutes) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${sign}${mins}분`;
  if (mins === 0) return `${sign}${hours}시간`;
  return `${sign}${hours}시간 ${mins}분`;
}
