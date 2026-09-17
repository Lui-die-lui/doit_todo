/** Pure SVG geometry helpers -- no React, no state, fully unit-testable. */

/**
 * A 4-point "sparkle"/"twinkle" glyph: tips at N/E/S/W joined by concave
 * quadratic curves that pinch in toward the center, rather than the straight
 * edges of a classic 5-point star polygon. Returns an SVG path `d` string
 * for use with <path>, not <polygon>.
 *
 * `waistRatio` controls how sharply the sides pinch in: smaller = sharper
 * concave waist (closer to the reference glyph), larger = plumper/rounder.
 */
export function sparklePath(cx: number, cy: number, outerR: number, waistRatio = 0.26): string {
  const waistR = outerR * waistRatio;
  const point = (angleDeg: number, r: number): [number, number] => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
  };
  const tips = [-90, 0, 90, 180].map((a) => point(a, outerR));
  const ctrls = [-45, 45, 135, 225].map((a) => point(a, waistR));

  const fmt = (n: number) => n.toFixed(3);
  let d = `M ${fmt(tips[0][0])} ${fmt(tips[0][1])}`;
  for (let i = 0; i < 4; i++) {
    const next = tips[(i + 1) % 4];
    d += ` Q ${fmt(ctrls[i][0])} ${fmt(ctrls[i][1])} ${fmt(next[0])} ${fmt(next[1])}`;
  }
  return d + " Z";
}

export type RayLine = { x1: number; y1: number; x2: number; y2: number };

export function radiatingRayLines(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  count = 8,
  rotationDeg = 0,
): RayLine[] {
  const lines: RayLine[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rotationDeg + (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    lines.push({
      x1: cx + Math.cos(rad) * innerR,
      y1: cy + Math.sin(rad) * innerR,
      x2: cx + Math.cos(rad) * outerR,
      y2: cy + Math.sin(rad) * outerR,
    });
  }
  return lines;
}

/** A short diagonal tick placed just outside a star to mark it overdue. */
export function overdueTick(cx: number, cy: number, offsetR: number, length = 3.4): RayLine {
  const rad = (45 * Math.PI) / 180;
  const bx = cx + Math.cos(rad) * offsetR;
  const by = cy + Math.sin(rad) * offsetR;
  const dx = Math.cos(rad + Math.PI / 2) * (length / 2);
  const dy = Math.sin(rad + Math.PI / 2) * (length / 2);
  return { x1: bx - dx, y1: by - dy, x2: bx + dx, y2: by + dy };
}
