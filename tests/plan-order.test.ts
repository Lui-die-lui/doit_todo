import { describe, expect, it } from "vitest";
import { MAX_REORDER_IDS, mergePlanOrder, parseOrderedPlanIds } from "@/lib/plan-order";

describe("parseOrderedPlanIds", () => {
  it("accepts a non-empty list of distinct positive integers and keeps its order", () => {
    expect(parseOrderedPlanIds([3, 1, 2])).toEqual([3, 1, 2]);
    expect(parseOrderedPlanIds([7])).toEqual([7]);
  });

  it.each([
    ["not an array", "1,2,3"],
    ["null", null],
    ["an object", { 0: 1 }],
    ["empty", []],
    ["a duplicate id", [1, 2, 1]],
    ["zero", [1, 0]],
    ["a negative id", [1, -2]],
    ["a fractional id", [1, 1.5]],
    ["a numeric string (ids must already be numbers)", [1, "2"]],
    ["NaN", [1, Number.NaN]],
    ["Infinity", [1, Number.POSITIVE_INFINITY]],
    ["an object entry", [1, { id: 2 }]],
  ])("rejects %s", (_name, input) => {
    expect(parseOrderedPlanIds(input)).toBeNull();
  });

  it("rejects more ids than any real plan list could hold", () => {
    const tooMany = Array.from({ length: MAX_REORDER_IDS + 1 }, (_, i) => i + 1);
    expect(parseOrderedPlanIds(tooMany)).toBeNull();
    expect(parseOrderedPlanIds(tooMany.slice(0, MAX_REORDER_IDS))).toHaveLength(MAX_REORDER_IDS);
  });
});

describe("mergePlanOrder", () => {
  it("uses the submitted order when it covers every active plan", () => {
    expect(mergePlanOrder([3, 1, 2], [1, 2, 3])).toEqual([3, 1, 2]);
  });

  it("keeps a plan the client didn't know about (created in another tab) after the arranged ones, in its current order", () => {
    // 9 and 8 exist server-side but weren't in the list the user arranged.
    expect(mergePlanOrder([2, 1], [1, 2, 9, 8])).toEqual([2, 1, 9, 8]);
  });

  it("never duplicates an id", () => {
    const merged = mergePlanOrder([4, 5], [5, 4, 6]);
    expect(merged).toEqual([4, 5, 6]);
    expect(new Set(merged).size).toBe(merged.length);
  });

  it("handles a partial submission by leaving the rest in their existing relative order", () => {
    expect(mergePlanOrder([3], [1, 2, 3, 4])).toEqual([3, 1, 2, 4]);
  });
});
