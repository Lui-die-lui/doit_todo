"use client";

import { useState, type CSSProperties } from "react";
import type { ConstellationLayout, ConstellationStar } from "@/lib/constellation";
import { describeStar, sizeTierForRadius } from "@/lib/constellation";
import { formatDateOnly, minutesToLabel } from "@/lib/date";
import { priorityLabels } from "@/lib/validation";
import { doneStarImageRect, round3, sparklePath } from "./starGeometry";

const VIEW = 116; // half-width of the square viewBox

function StarMark({
  star,
  active,
  onEnter,
  onLeave,
}: {
  star: ConstellationStar;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const label = describeStar(star);
  const notStarted = star.status === "TODO" && star.workLogCount === 0;

  return (
    <a
      href={`/tasks/${star.id}`}
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className="cursor-pointer outline-none"
    >
      <title>{label}</title>

      {/* Invisible hit-area, decoupled from the visual size: ~10 viewBox units is
          roughly a 28px target on a 320px-wide phone, so tiny stars stay tappable. */}
      <circle cx={star.x} cy={star.y} r={Math.max(star.radius + 4, 10)} fill="transparent" />

      {/* Actual-work trace: one small dot per work log (capped), arced above the star. */}
      {star.workLogCount > 0 &&
        Array.from({ length: Math.min(star.workLogCount, 8) }, (_, i) => {
          const count = Math.min(star.workLogCount, 8);
          const spread = 70; // degrees of arc the dots occupy
          const startDeg = -90 - spread / 2;
          const deg = count === 1 ? -90 : startDeg + (spread / (count - 1)) * i;
          const rad = (deg * Math.PI) / 180;
          const r = star.radius + (star.hasBlocker ? 5.6 : 2.6);
          return (
            <circle
              key={i}
              cx={round3(star.x + Math.cos(rad) * r)}
              cy={round3(star.y + Math.sin(rad) * r)}
              r={0.7}
              fill="#666660"
            />
          );
        })}

      {active && (
        <circle
          cx={star.x}
          cy={star.y}
          r={star.radius + 5}
          fill="none"
          stroke="#11110F"
          strokeWidth={1}
        />
      )}

      {star.hasBlocker && (
        <circle
          cx={star.x}
          cy={star.y}
          r={star.radius + 3.2}
          fill="none"
          stroke="#666660"
          strokeWidth={0.8}
          strokeDasharray="1.6 2.2"
        />
      )}

      {star.status === "DONE" ? (
        (() => {
          const rect = doneStarImageRect(star.x, star.y, star.radius, sizeTierForRadius(star.radius));
          return (
            <image
              className="doit-star-reveal"
              href={rect.href}
              x={round3(rect.x)}
              y={round3(rect.y)}
              width={round3(rect.width)}
              height={round3(rect.height)}
            />
          );
        })()
      ) : notStarted ? (
        <circle cx={star.x} cy={star.y} r={star.radius * 0.4} fill="#999992" fillOpacity={0.5} />
      ) : (
        <path d={sparklePath(star.x, star.y, star.radius)} fill="none" stroke="#666660" strokeWidth={1} />
      )}
    </a>
  );
}

/** Short-form date for tight ring labels: "2026-10-04" -> "10.04". */
function shortDate(iso: string): string {
  return formatDateOnly(iso).slice(5);
}

const BEZEL_RADIUS = 100;

export function ConstellationSVG({
  layout,
  planTitle,
  orbitDateLabels,
  nextPlan,
}: {
  layout: ConstellationLayout;
  planTitle: string;
  /** Real date each orbit ring's outer edge represents -- [inner, mid, outer]. */
  orbitDateLabels?: [string, string, string];
  /** The plan this one's reflection improvement was carried into, if any -- drawn as a dashed bearing line. */
  nextPlan?: { id: number; title: string } | null;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeStar = layout.stars.find((s) => s.id === activeId) ?? null;
  const doneCount = layout.stars.filter((s) => s.status === "DONE").length;

  const bezelTicks = Array.from({ length: 60 }, (_, i) => {
    const deg = i * 6;
    const rad = (deg * Math.PI) / 180;
    const long = i % 5 === 0;
    const inner = BEZEL_RADIUS - (long ? 3.5 : 1.8);
    return {
      key: deg,
      x1: round3(Math.cos(rad) * inner),
      y1: round3(Math.sin(rad) * inner),
      x2: round3(Math.cos(rad) * BEZEL_RADIUS),
      y2: round3(Math.sin(rad) * BEZEL_RADIUS),
    };
  });

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}`}
        className="mx-auto h-auto w-full max-w-[480px]"
        role="group"
        aria-label={`${planTitle} 별자리, 할 일 ${layout.stars.length}개 중 ${doneCount}개 완료`}
      >
        {/* Faint radial hairlines every 30° -- the "chart" underlay that keeps the field from reading as empty. */}
        {Array.from({ length: 12 }, (_, i) => {
          const rad = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={round3(Math.cos(rad) * 6)}
              y1={round3(Math.sin(rad) * 6)}
              x2={round3(Math.cos(rad) * (BEZEL_RADIUS - 4))}
              y2={round3(Math.sin(rad) * (BEZEL_RADIUS - 4))}
              stroke="#E8E8E2"
              strokeWidth={0.35}
            />
          );
        })}

        {/* Astrolabe-style bezel: a plain graduated rim, like a protractor edge -- carries no data of its own. */}
        {bezelTicks.map((t) => (
          <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#D2D2CB" strokeWidth={0.4} />
        ))}
        <circle cx={0} cy={0} r={BEZEL_RADIUS} fill="none" stroke="#E8E8E2" strokeWidth={0.5} />
        {(
          [
            { deg: 0, x: BEZEL_RADIUS + 3, y: 1.6, anchor: "start" },
            { deg: 90, x: 0, y: BEZEL_RADIUS + 7, anchor: "middle" },
            { deg: 180, x: -BEZEL_RADIUS - 3, y: 1.6, anchor: "end" },
            { deg: 270, x: 0, y: -BEZEL_RADIUS - 4, anchor: "middle" },
          ] as const
        ).map((m) => (
          <text
            key={m.deg}
            x={m.x}
            y={m.y}
            textAnchor={m.anchor}
            fontSize={4}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            fill="#999992"
          >
            {m.deg}°
          </text>
        ))}

        {/* Bearing toward the next constellation, when this plan's improvement was carried forward. */}
        {nextPlan &&
          (() => {
            // Along the 45° diagonal the viewBox corner sits ~164 units out, so there is
            // room past the bezel for a readable dashed bearing line and arrowhead.
            const rad = Math.PI / 4;
            const r0 = BEZEL_RADIUS + 5;
            const r1 = 150;
            const x0 = round3(Math.cos(rad) * r0);
            const y0 = round3(Math.sin(rad) * r0);
            const x1 = round3(Math.cos(rad) * r1);
            const y1 = round3(Math.sin(rad) * r1);
            return (
              <g>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#11110F" strokeWidth={0.6} strokeDasharray="1.5 2" />
                <polygon
                  points={`${x1},${y1} ${x1 - 3.6},${y1 - 0.8} ${x1 - 0.8},${y1 - 3.6}`}
                  fill="#11110F"
                />
                <text
                  x={x0 + 4}
                  y={y0 - 1}
                  fontSize={3.8}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  fill="#666660"
                  transform={`rotate(45 ${x0 + 4} ${y0 - 1})`}
                >
                  NEXT → {nextPlan.title.length > 14 ? `${nextPlan.title.slice(0, 14)}…` : nextPlan.title}
                </text>
              </g>
            );
          })()}

        {layout.orbitRadii.map((r, i) => (
          <circle
            key={r}
            cx={0}
            cy={0}
            r={r}
            fill="none"
            stroke="#E8E8E2"
            strokeWidth={0.5}
            strokeDasharray={i === layout.orbitRadii.length - 1 ? "1 5" : "1 3.5"}
          />
        ))}

        {orbitDateLabels &&
          orbitDateLabels.map((iso, i) => (
            <text
              key={iso}
              x={2}
              y={-layout.orbitRadii[i] - 2}
              fontSize={4.5}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              fill="#999992"
            >
              {shortDate(iso)}
            </text>
          ))}

        {layout.connections.map((c, i) => {
          const length = round3(Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y));
          return (
            <line
              key={i}
              x1={c.from.x}
              y1={c.from.y}
              x2={c.to.x}
              y2={c.to.y}
              stroke="#11110F"
              strokeOpacity={0.55}
              strokeWidth={0.4}
              className="doit-line-draw"
              style={
                {
                  strokeDasharray: length,
                  "--doit-line-length": length,
                } as CSSProperties
              }
            />
          );
        })}

        <circle
          cx={0}
          cy={0}
          r={layout.isComplete ? 3.6 : 2}
          fill={layout.isComplete ? "#11110F" : "none"}
          stroke="#11110F"
          strokeWidth={1}
        />

        {layout.stars.map((star) => (
          <StarMark
            key={star.id}
            star={star}
            active={activeId === star.id}
            onEnter={() => setActiveId(star.id)}
            onLeave={() => setActiveId((cur) => (cur === star.id ? null : cur))}
          />
        ))}
      </svg>

      <div
        aria-live="polite"
        className="min-h-[4.5rem] border border-line bg-surface-muted px-4 py-3 text-xs text-ink-500"
      >
        {activeStar ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-4">
              <dt className="sr-only">할 일</dt>
              <dd className="text-sm font-medium text-ink-900">{activeStar.title}</dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">STATUS</dt>
              <dd>{activeStar.status === "DONE" ? "완료" : activeStar.isOverdue ? "지연" : "진행 중"}</dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">DUE</dt>
              <dd className="font-mono">{formatDateOnly(activeStar.dueDate)}</dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">PRIORITY</dt>
              <dd>{priorityLabels[activeStar.priority]}</dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">EST / ACTUAL</dt>
              <dd>
                {minutesToLabel(activeStar.estimatedMinutes)} / {minutesToLabel(activeStar.actualMinutesTotal)}
              </dd>
            </div>
          </dl>
        ) : (
          <p>별을 가리키거나 키보드로 이동하면 상세 정보가 여기에 표시됩니다. 클릭하면 해당 할 일로 이동합니다.</p>
        )}
      </div>
    </div>
  );
}
