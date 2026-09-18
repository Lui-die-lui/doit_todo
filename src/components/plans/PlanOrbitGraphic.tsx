/**
 * NOT real user data. A small set of hand-picked coordinates for the purely
 * decorative orbit graphic shown next to PLAN's empty state. No plan/task query --
 * this component takes no props and reads nothing.
 */
const DEMO_STARS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: 0, y: -44, r: 4.5 },
  { x: 38, y: -22, r: 3 },
  { x: 38, y: 22, r: 3.5 },
  { x: 0, y: 44, r: 3 },
  { x: -38, y: 22, r: 4 },
  { x: -38, y: -22, r: 3 },
];

const DEMO_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
];

/** Static, non-interactive orbit illustration -- deliberately never wired to real
 * plan/task data, since it's shown precisely when there is none yet. */
export function PlanOrbitGraphic() {
  return (
    <svg
      viewBox="-64 -64 128 128"
      className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={0} cy={0} r={58} fill="none" stroke="#E8E8E2" strokeWidth={0.6} />
      <circle cx={0} cy={0} r={44} fill="none" stroke="#D2D2CB" strokeWidth={0.6} strokeDasharray="1 4" />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = (i * 30 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={Math.cos(rad) * 6}
            y1={Math.sin(rad) * 6}
            x2={Math.cos(rad) * 56}
            y2={Math.sin(rad) * 56}
            stroke="#E8E8E2"
            strokeWidth={0.4}
          />
        );
      })}
      {DEMO_CONNECTIONS.map(([fromIdx, toIdx], i) => {
        const from = DEMO_STARS[fromIdx];
        const to = DEMO_STARS[toIdx];
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#11110F"
            strokeOpacity={0.45}
            strokeWidth={0.5}
          />
        );
      })}
      {DEMO_STARS.map((star, i) => (
        <path
          key={i}
          d={`M ${star.x} ${star.y - star.r} L ${star.x + star.r * 0.3} ${star.y - star.r * 0.3} L ${star.x + star.r} ${star.y} L ${star.x + star.r * 0.3} ${star.y + star.r * 0.3} L ${star.x} ${star.y + star.r} L ${star.x - star.r * 0.3} ${star.y + star.r * 0.3} L ${star.x - star.r} ${star.y} L ${star.x - star.r * 0.3} ${star.y - star.r * 0.3} Z`}
          fill="#11110F"
        />
      ))}
      <circle cx={0} cy={0} r={2.4} fill="none" stroke="#11110F" strokeWidth={1} />
    </svg>
  );
}
