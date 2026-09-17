import { describe, expect, it } from "vitest";
import { sparklePath } from "@/components/constellation/starGeometry";

describe("sparklePath", () => {
  it("starts and ends the path at the same point (closed shape)", () => {
    const d = sparklePath(10, -5, 8);
    expect(d.startsWith("M 10.000 -13.000")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("is deterministic for the same inputs", () => {
    expect(sparklePath(3, 4, 6, 0.3)).toBe(sparklePath(3, 4, 6, 0.3));
  });

  /** Splits "M x y Q cx cy x y Q cx cy x y ..." into [[x,y], [cx,cy,x,y], ...] number groups. */
  function parseSegments(d: string): number[][] {
    return d
      .split(/(?=[MQZ])/)
      .filter((s) => s.trim() && s.trim() !== "Z")
      .map((seg) => seg.trim().slice(1).trim().split(/\s+/).map(Number));
  }

  it("places the four tips at N/E/S/W at the given outer radius", () => {
    const d = sparklePath(0, 0, 10);
    const segments = parseSegments(d); // [M: [x,y], Q1: [cx,cy,x,y], Q2, Q3, Q4]
    expect(segments).toHaveLength(5);

    const tips: [number, number][] = [
      [segments[0][0], segments[0][1]], // N (move-to)
      [segments[1][2], segments[1][3]], // E (end of 1st Q)
      [segments[2][2], segments[2][3]], // S (end of 2nd Q)
      [segments[3][2], segments[3][3]], // W (end of 3rd Q)
    ];
    for (const [x, y] of tips) {
      expect(Math.hypot(x, y)).toBeCloseTo(10, 3);
    }
    // 4th Q closes the path back to the N tip.
    expect(segments[4][2]).toBeCloseTo(tips[0][0], 3);
    expect(segments[4][3]).toBeCloseTo(tips[0][1], 3);
  });

  it("pulls the waist control points closer to center as waistRatio shrinks", () => {
    const ctrlDistance = (waistRatio: number) => {
      const segments = parseSegments(sparklePath(0, 0, 10, waistRatio));
      const [cx, cy] = segments[1]; // first Q's control point
      return Math.hypot(cx, cy);
    };
    expect(ctrlDistance(0.1)).toBeLessThan(ctrlDistance(0.4));
  });
});
