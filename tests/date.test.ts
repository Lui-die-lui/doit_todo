import { describe, expect, it } from "vitest";
import { daysBetweenInclusive, isOverdue, seoulTodayDateString } from "@/lib/date";

describe("seoulTodayDateString", () => {
  it("formats as YYYY-MM-DD regardless of server-local timezone", () => {
    // 2026-01-01 00:30 UTC is already 2026-01-01 09:30 in Seoul (UTC+9) -- same date.
    const d = new Date("2026-01-01T00:30:00.000Z");
    expect(seoulTodayDateString(d)).toBe("2026-01-01");
  });

  it("rolls over to the next Seoul date for late-UTC timestamps", () => {
    // 2025-12-31 15:30 UTC is 2026-01-01 00:30 in Seoul -- the Seoul date is already the next day.
    const d = new Date("2025-12-31T15:30:00.000Z");
    expect(seoulTodayDateString(d)).toBe("2026-01-01");
  });
});

describe("isOverdue", () => {
  const today = "2026-09-17";

  it("is not overdue when due date is today or in the future", () => {
    expect(isOverdue("2026-09-17", "TODO", today)).toBe(false);
    expect(isOverdue("2026-09-18", "TODO", today)).toBe(false);
  });

  it("is overdue only when TODO and due date has passed", () => {
    expect(isOverdue("2026-09-16", "TODO", today)).toBe(true);
  });

  it("a completed task is never overdue even if the due date passed", () => {
    expect(isOverdue("2026-09-01", "DONE", today)).toBe(false);
  });
});

describe("daysBetweenInclusive", () => {
  it("counts a single-day range as 1", () => {
    expect(daysBetweenInclusive("2026-09-17", "2026-09-17")).toBe(1);
  });

  it("counts inclusively across a month boundary", () => {
    expect(daysBetweenInclusive("2026-09-29", "2026-10-02")).toBe(4);
  });

  it("returns null when the range is inverted", () => {
    expect(daysBetweenInclusive("2026-09-17", "2026-09-10")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(daysBetweenInclusive("2026-09-17", "not-a-date")).toBeNull();
  });
});
