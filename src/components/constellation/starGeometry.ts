/** Pure SVG geometry helpers -- no React, no state, fully unit-testable. */

/**
 * Rounds a coordinate to 3 decimal places. `Math.cos`/`Math.sin` (and
 * `Math.hypot`) aren't required by spec to be bit-identical across engines,
 * so the same trig call can return a last-ULP-different float during SSR
 * (Node) vs. hydration (the browser) -- React then flags a hydration
 * mismatch on the raw, unrounded SVG attribute. Rounding before it's used
 * as an attribute value collapses that ULP-level noise (well under 0.001)
 * without any visible effect on this viewBox's scale.
 */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * A 4-point "sparkle"/"twinkle" glyph: tips at N/E/S/W joined by concave
 * quadratic curves that pinch in toward the center, rather than the straight
 * edges of a classic 5-point star polygon. Returns an SVG path `d` string
 * for use with <path>, not <polygon>.
 *
 * `waistRatio` controls how sharply the sides pinch in: smaller = sharper
 * concave waist (closer to the reference glyph), larger = plumper/rounder.
 */
export function sparklePath(cx: number, cy: number, outerR: number, waistRatio = 0.26, rotationDeg = 0): string {
  const waistR = outerR * waistRatio;
  const point = (angleDeg: number, r: number): [number, number] => {
    const rad = ((angleDeg + rotationDeg) * Math.PI) / 180;
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

/**
 * A completed star's glyph, by size tier, is the actual artwork from
 * image/stars.png (glyphs 1/3/4 -- the X, 2nd glyph, is not used), cropped to
 * public/stars/*.png and drawn with an SVG <image>, not redrawn as a path.
 * width/height are each cropped file's true pixel size, needed to preserve
 * its aspect ratio when it's scaled to a given star radius.
 */
export const DONE_STAR_IMAGES: Record<"small" | "medium" | "large", { src: string; width: number; height: number }> = {
  small: { src: "/stars/small.png", width: 232, height: 395 },
  medium: { src: "/stars/medium.png", width: 390, height: 395 },
  large: { src: "/stars/large.png", width: 387, height: 395 },
};

/** Bounding box (in viewBox units) to draw a size tier's image so its longest axis spans 2*radius, centered on (cx, cy). */
export function doneStarImageRect(
  cx: number,
  cy: number,
  radius: number,
  tier: "small" | "medium" | "large",
): { href: string; x: number; y: number; width: number; height: number } {
  const img = DONE_STAR_IMAGES[tier];
  const scale = (radius * 2) / Math.max(img.width, img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return { href: img.src, x: cx - width / 2, y: cy - height / 2, width, height };
}
