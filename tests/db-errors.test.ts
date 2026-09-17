import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/lib/db-errors";

describe("isUniqueViolation", () => {
  it("detects a raw postgres-js error with code on the error itself", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects drizzle-orm's DrizzleQueryError wrapper, which nests the real code under .cause", () => {
    // This is the actual shape drizzle-orm (>=0.45) throws: the SQLSTATE
    // code lives on err.cause.code, not err.code. Regression test for the
    // bug where completion dedup silently failed to catch this and the
    // duplicate-completion request surfaced as a 500 instead of "already done".
    const wrapped = { message: "Failed query", cause: { code: "23505", message: "duplicate key value" } };
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation({ cause: { code: "42601" } })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
