import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/**
 * NOT real user data. Hand-picked fixed coordinates for the purely decorative
 * background shown on the signed-out `/dashboard` gate. This file makes no
 * plan/task/work-log query and never will -- it must keep working with zero
 * database access, since it's the thing a signed-out visitor sees.
 */
const DEMO_STAR_SIZE = { small: 4, medium: 7, large: 11 } as const;

type DemoStarTier = keyof typeof DEMO_STAR_SIZE;

type DemoStar = {
  x: number;
  y: number;
  tier: DemoStarTier;
  /** Major stars get a soft glow halo and a slow opacity twinkle. */
  major?: boolean;
};

const DEMO_STAR_POINTS: readonly DemoStar[] = [
  { x: 30, y: -6, tier: "large", major: true },
  { x: 14, y: 30, tier: "medium" },
  { x: -18, y: 26, tier: "small" },
  { x: -34, y: -2, tier: "medium", major: true },
  { x: -14, y: -30, tier: "small" },
  { x: 18, y: -26, tier: "medium" },
  { x: 66, y: 18, tier: "large", major: true },
  { x: 4, y: 68, tier: "small" },
  { x: -70, y: -10, tier: "medium" },
  { x: -6, y: -72, tier: "small" },
  { x: 50, y: -54, tier: "medium" },
  { x: -52, y: 50, tier: "small" },
];

/** Pairs of indexes into DEMO_STAR_POINTS -- decorative connecting lines only. */
const DEMO_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [0, 6],
  [6, 10],
  [3, 8],
  [8, 11],
  [1, 7],
  [4, 9],
];

const DEMO_ORBIT_RADII: readonly number[] = [34, 62, 90];
/** Which orbit ring gets the dashed, very-slow rotation. */
const SPINNING_ORBIT_RADIUS = 62;
const VIEW = 116;

/** Purely decorative, non-interactive constellation shape -- no links, no labels,
 * no per-star detail. It only needs to read as "shape, out of focus," not convey
 * information, so it carries none. */
function DemoConstellationBackground() {
  return (
    <svg
      viewBox={`-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}`}
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="gate-star-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#11110F" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#11110F" stopOpacity={0} />
        </radialGradient>
      </defs>

      {DEMO_ORBIT_RADII.map((r) =>
        r === SPINNING_ORBIT_RADIUS ? (
          <circle
            key={r}
            className="gate-orbit-spin"
            cx={0}
            cy={0}
            r={r}
            fill="none"
            stroke="#11110F"
            strokeOpacity={0.3}
            strokeWidth={0.6}
            strokeDasharray="1 7"
          />
        ) : (
          <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#11110F" strokeOpacity={0.16} strokeWidth={0.5} />
        ),
      )}
      <circle cx={0} cy={0} r={104} fill="none" stroke="#11110F" strokeOpacity={0.1} strokeWidth={0.5} />

      {DEMO_CONNECTIONS.map(([fromIdx, toIdx], i) => {
        const from = DEMO_STAR_POINTS[fromIdx];
        const to = DEMO_STAR_POINTS[toIdx];
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#11110F"
            strokeOpacity={0.32}
            strokeWidth={0.5}
          />
        );
      })}

      {DEMO_STAR_POINTS.map((star, i) => {
        const r = DEMO_STAR_SIZE[star.tier] / 2;
        return (
          <g key={i}>
            {star.major && <circle cx={star.x} cy={star.y} r={r * 4.5} fill="url(#gate-star-glow)" />}
            {star.major && (
              <circle cx={star.x} cy={star.y} r={r + 5} fill="none" stroke="#11110F" strokeOpacity={0.18} strokeWidth={0.5} />
            )}
            <circle
              cx={star.x}
              cy={star.y}
              r={r}
              fill="#11110F"
              className={
                star.major
                  ? i % 2 === 0
                    ? "gate-star-twinkle"
                    : "gate-star-twinkle gate-star-twinkle--delay"
                  : undefined
              }
              style={star.major ? ({ "--gate-star-opacity": 0.75 } as CSSProperties) : { opacity: 0.55 }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-ink-900">
      <rect x={5} y={11} width={14} height={10} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" strokeWidth={1.4} />
      <circle cx={12} cy={15.5} r={1.4} fill="currentColor" />
    </svg>
  );
}

/** Shared glassmorphism panel styling for both the signed-out gate and the
 * signed-in "no plans yet" panel -- rounded, near-invisible border, frosted glass. */
export const GLASS_PANEL_CLASSNAME =
  "relative z-10 flex w-full max-w-[420px] flex-col items-center gap-5 rounded-3xl border border-white/30 bg-paper/65 px-7 py-9 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_40px_rgba(17,17,15,0.14)] backdrop-blur-xl sm:px-9";

/**
 * Shared decorative backdrop -- the blurred demo constellation + vignette --
 * behind either the signed-out login gate or the signed-in "no plans yet" panel.
 * Renders no session-derived data; the panel content is passed in as `children`.
 */
export function DemoConstellationBackdrop({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-12rem)] items-center justify-center overflow-hidden px-5 py-10">
      {/* Demo constellation -- large, extends well past the panel's edges. The blur
          lives on this layer alone (a `filter`, not backdrop-filter), so it stays soft
          and out-of-focus everywhere it's visible, independent of what sits in front. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center blur-sm"
      >
        <div className="aspect-square w-[min(78vw,74vh,900px)]">
          <DemoConstellationBackground />
        </div>
      </div>

      {/* Vignette: brighter/clearer center, the demo constellation fades a little
          toward the viewport edges instead of hard-clipping. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 0%, transparent 42%, rgba(252,252,250,0.4) 78%, rgba(252,252,250,0.72) 100%)",
        }}
      />

      {children}
    </section>
  );
}

/**
 * The signed-out `/dashboard` state: the shared backdrop behind an opaque-ish
 * login prompt -- a "locked observatory," not a data screen. Renders no
 * session-derived data -- src/app/dashboard/page.tsx only reaches this component
 * when there is no session at all.
 */
export function DemoConstellationGate() {
  return (
    <DemoConstellationBackdrop>
      {/* backdrop-blur is scoped to this panel alone -- nowhere else on the screen
          gets the stronger glass effect. */}
      <div className={GLASS_PANEL_CLASSNAME}>
        <LockGlyph />
        <div className="flex flex-col gap-3">
          <p className="label-coord text-[10px] text-ink-400">OBSERVATORY · LOCKED</p>
          <h1 className="text-xl font-bold leading-snug text-ink-900 sm:text-2xl">
            아직 당신의 궤도가
            <br />
            열리지 않았어요.
          </h1>
          <p className="text-sm text-ink-500">나만의 계획을 별자리로 이어가려면 로그인하세요.</p>
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <Link
            href="/login?tab=login"
            className="inline-flex w-full items-center justify-center rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2"
          >
            로그인하고 궤도 열기
          </Link>
          <Link
            href="/login?tab=signup"
            className="text-xs font-medium text-ink-500 underline underline-offset-2 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2"
          >
            처음이라면 회원가입
          </Link>
        </div>
      </div>
    </DemoConstellationBackdrop>
  );
}
