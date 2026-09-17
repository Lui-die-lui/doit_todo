import type { ConstellationLayout } from "@/lib/constellation";

const VIEW = 100;

/** Small, non-interactive preview used in list rows. The full interactive view lives at ConstellationSVG. */
export function MiniConstellation({ layout, title }: { layout: ConstellationLayout; title: string }) {
  const doneCount = layout.stars.filter((s) => s.status === "DONE").length;

  return (
    <svg
      viewBox={`-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}`}
      className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
      role="img"
      aria-label={`${title} 별자리 미리보기, ${layout.stars.length}개 중 ${doneCount}개 완료`}
    >
      {layout.orbitRadii.map((r) => (
        <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#E8E8E2" strokeWidth={1} />
      ))}
      {layout.connections.map((c, i) => (
        <line
          key={i}
          x1={c.from.x}
          y1={c.from.y}
          x2={c.to.x}
          y2={c.to.y}
          stroke="#11110F"
          strokeOpacity={0.5}
          strokeWidth={1.4}
        />
      ))}
      {layout.stars.map((star) =>
        star.status === "DONE" ? (
          <circle key={star.id} cx={star.x} cy={star.y} r={Math.max(star.radius * 0.9, 3)} fill="#11110F" />
        ) : (
          <circle
            key={star.id}
            cx={star.x}
            cy={star.y}
            r={Math.max(star.radius * 0.7, 2)}
            fill="none"
            stroke="#999992"
            strokeWidth={1.4}
          />
        ),
      )}
    </svg>
  );
}
