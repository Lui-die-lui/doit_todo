import { afterEach, describe, expect, it } from "vitest";
import {
  clampTimeField,
  daysInMonth,
  formatDateTimeValue,
  formatDateValue,
  formatDisplay,
  fromCalendarDate,
  isWithinRange,
  parseAny,
  parseDate,
  parseDateTime,
  seoulNow,
  seoulToday,
  shiftMonth,
  stepTimeField,
  toCalendarDate,
} from "@/lib/date-picker";
import { seoulLocalInputToUtcDate } from "@/lib/date";

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("parsing", () => {
  it("accepts real calendar dates, including leap days", () => {
    expect(parseDate("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseDate("2000-02-29")).toEqual({ y: 2000, m: 2, d: 29 });
    expect(parseDate("2026-12-31")).toEqual({ y: 2026, m: 12, d: 31 });
    expect(parseDate("2026-01-31")).toEqual({ y: 2026, m: 1, d: 31 });
  });

  it("rejects impossible dates and malformed strings", () => {
    for (const bad of ["2026-02-29", "2100-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00", "26-01-01", "2026-1-1", "", "abc"]) {
      expect(parseDate(bad), bad).toBeNull();
    }
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it("parses datetime-local values (T or space, optional seconds)", () => {
    expect(parseDateTime("2026-09-20T14:30")).toEqual({ y: 2026, m: 9, d: 20, h: 14, min: 30 });
    expect(parseDateTime("2026-09-20 14:30")).toEqual({ y: 2026, m: 9, d: 20, h: 14, min: 30 });
    expect(parseDateTime("2026-09-20T14:30:45.123")).toEqual({ y: 2026, m: 9, d: 20, h: 14, min: 30 });
    expect(parseDateTime("2026-09-20T00:00")).toEqual({ y: 2026, m: 9, d: 20, h: 0, min: 0 });
    expect(parseDateTime("2026-09-20T23:59")).toEqual({ y: 2026, m: 9, d: 20, h: 23, min: 59 });
  });

  it("rejects bad datetimes", () => {
    for (const bad of ["2026-09-20T24:00", "2026-09-20T12:60", "2026-02-30T10:00", "2026-09-20", "2026-09-20T1:00"]) {
      expect(parseDateTime(bad), bad).toBeNull();
    }
  });

  it("parseAny reads either format", () => {
    expect(parseAny("2026-09-20")).toEqual({ y: 2026, m: 9, d: 20 });
    expect(parseAny("2026-09-20T09:05")).toMatchObject({ y: 2026, m: 9, d: 20, h: 9, min: 5 });
    expect(parseAny("nope")).toBeNull();
  });
});

describe("formatting keeps the exact submitted formats", () => {
  it("date value is zero-padded YYYY-MM-DD", () => {
    expect(formatDateValue({ y: 2026, m: 3, d: 5 })).toBe("2026-03-05");
    expect(formatDateValue({ y: 987, m: 1, d: 1 })).toBe("0987-01-01");
  });

  it("datetime value is YYYY-MM-DDTHH:mm (no seconds, no zone suffix)", () => {
    expect(formatDateTimeValue({ y: 2026, m: 9, d: 20 }, { h: 9, min: 5 })).toBe("2026-09-20T09:05");
    expect(formatDateTimeValue({ y: 2026, m: 12, d: 31 }, { h: 23, min: 59 })).toBe("2026-12-31T23:59");
  });

  it("display string matches the spec", () => {
    expect(formatDisplay({ y: 2026, m: 9, d: 20 }, { h: 14, min: 30 })).toBe("2026. 09. 20 · 14:30");
    expect(formatDisplay({ y: 2026, m: 9, d: 2 })).toBe("2026. 09. 02");
  });

  it("round-trips every minute of a day", () => {
    for (let h = 0; h < 24; h++) {
      for (let min = 0; min < 60; min++) {
        const value = formatDateTimeValue({ y: 2026, m: 9, d: 20 }, { h, min });
        expect(parseDateTime(value)).toEqual({ y: 2026, m: 9, d: 20, h, min });
      }
    }
  });

  it("the value the picker submits is what the server's Seoul conversion expects (no 9h drift)", () => {
    expect(seoulLocalInputToUtcDate("2026-09-20T09:00")?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(seoulLocalInputToUtcDate("2026-09-20T00:15")?.toISOString()).toBe("2026-09-19T15:15:00.000Z");
    expect(seoulLocalInputToUtcDate("2026-12-31T23:45")?.toISOString()).toBe("2026-12-31T14:45:00.000Z");
    expect(seoulLocalInputToUtcDate("2028-02-29T12:00")?.toISOString()).toBe("2028-02-29T03:00:00.000Z");
  });
});

describe("calendar dates never drift, whatever the browser's time zone", () => {
  const samples = ["2026-01-01", "2026-02-28", "2028-02-29", "2026-03-31", "2026-09-30", "2026-12-31", "2027-01-01", "2026-03-08", "2026-11-01", "2011-12-29", "2011-12-31"];
  const zones = ["UTC", "Asia/Seoul", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Apia", "America/Sao_Paulo", "Europe/London", "Pacific/Pago_Pago"];

  for (const tz of zones) {
    it(`${tz}: toCalendarDate -> fromCalendarDate is the identity`, () => {
      process.env.TZ = tz;
      for (const s of samples) {
        const p = parseDate(s)!;
        expect(formatDateValue(fromCalendarDate(toCalendarDate(p))), `${s} in ${tz}`).toBe(s);
      }
    });
  }

  it("month stepping lands on the right month across a year boundary", () => {
    process.env.TZ = "America/Los_Angeles";
    const dec = toCalendarDate({ y: 2026, m: 12, d: 15 });
    expect(fromCalendarDate(shiftMonth(dec, 1))).toEqual({ y: 2027, m: 1, d: 1 });
    expect(fromCalendarDate(shiftMonth(toCalendarDate({ y: 2027, m: 1, d: 31 }), -1))).toEqual({ y: 2026, m: 12, d: 1 });
    expect(fromCalendarDate(shiftMonth(toCalendarDate({ y: 2026, m: 1, d: 31 }), 1))).toEqual({ y: 2026, m: 2, d: 1 });
  });

  it("daysInMonth knows leap years and month ends", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("Asia/Seoul 'today' and 'now' do not depend on the browser zone", () => {
  it("uses Seoul's calendar day around the UTC/KST boundary", () => {
    process.env.TZ = "America/Los_Angeles";
    // 2026-09-20 16:00Z is 2026-09-21 01:00 in Seoul (and still the 20th in Los Angeles / UTC)
    const instant = new Date("2026-09-20T16:00:00Z");
    expect(seoulToday(instant)).toEqual({ y: 2026, m: 9, d: 21 });
    expect(seoulNow(instant)).toEqual({ y: 2026, m: 9, d: 21, h: 1, min: 0 });
    // 2026-12-31 15:30Z is 2027-01-01 00:30 in Seoul: year rolls over
    expect(seoulNow(new Date("2026-12-31T15:30:00Z"))).toEqual({ y: 2027, m: 1, d: 1, h: 0, min: 30 });
  });
});

describe("time fields", () => {
  it("clamps typed text into range", () => {
    expect(clampTimeField("7", 23)).toBe(7);
    expect(clampTimeField("99", 23)).toBe(23);
    expect(clampTimeField("99", 59)).toBe(59);
    expect(clampTimeField("", 59, 0)).toBe(0);
    expect(clampTimeField("ab", 23, 9)).toBe(9);
    expect(clampTimeField("-4", 23)).toBe(0);
  });

  it("steps and wraps without limiting minutes to 5/10 increments", () => {
    expect(stepTimeField(30, 1, 59)).toBe(31);
    expect(stepTimeField(59, 1, 59)).toBe(0);
    expect(stepTimeField(0, -1, 59)).toBe(59);
    expect(stepTimeField(23, 1, 23)).toBe(0);
    expect(stepTimeField(0, -1, 23)).toBe(23);
    expect(stepTimeField(7, 10, 59)).toBe(17);
  });
});

describe("min / max", () => {
  it("date-only bounds", () => {
    expect(isWithinRange("2026-09-20", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinRange("2026-08-31", "2026-09-01", "2026-09-30")).toBe(false);
    expect(isWithinRange("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
    expect(isWithinRange("2026-09-01", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinRange("2026-09-30", "2026-09-01", "2026-09-30")).toBe(true);
  });

  it("datetime bounds compare the time too", () => {
    expect(isWithinRange("2026-09-20T09:00", "2026-09-20T09:30")).toBe(false);
    expect(isWithinRange("2026-09-20T09:30", "2026-09-20T09:30")).toBe(true);
    expect(isWithinRange("2026-09-20T18:01", undefined, "2026-09-20T18:00")).toBe(false);
  });

  it("empty value and missing bounds are always fine", () => {
    expect(isWithinRange("", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinRange("2026-09-20")).toBe(true);
  });
});
