"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ConstellationLayout, ConstellationStar } from "@/lib/constellation";
import { formatDateOnly } from "@/lib/date";
import { InteractiveStar, StarInspectorBody } from "./InteractiveStar";
import { round3 } from "./starGeometry";

const VIEW = 116;
const BEZEL_RADIUS = 100;
const PANEL_WIDTH = 288;
const PANEL_GAP = 18;
const PANEL_EST_HEIGHT = 250;
const SHOW_DELAY_MS = 80;
const HIDE_DELAY_MS = 220;

type PanelPosition = { left: number; top: number };

/** Short-form date for tight ring labels: "2026-10-04" -> "10.04". */
function shortDate(iso: string): string {
  return formatDateOnly(iso).slice(5);
}

export function ConstellationSVG({
  layout,
  planTitle,
  orbitDateLabels,
  nextPlan,
}: {
  layout: ConstellationLayout;
  planTitle: string;
  orbitDateLabels?: [string, string, string];
  nextPlan?: { id: number; title: string } | null;
}) {
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const [isCoarse, setIsCoarse] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const starRefs = useRef(new Map<number, SVGGElement>());
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const activeId = pinnedId ?? hoverId;
  const activeStar = activeId !== null ? layout.stars.find((star) => star.id === activeId) ?? null : null;
  const indexById = new Map(layout.stars.map((star, index) => [star.id, index + 1]));
  const doneCount = layout.stars.filter((star) => star.status === "DONE").length;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (max-width: 640px)");
    const apply = () => setIsCoarse(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  const clearTimers = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  const scheduleShow = useCallback((id: number) => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    showTimer.current = window.setTimeout(() => setHoverId(id), SHOW_DELAY_MS);
  }, []);

  const scheduleHide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = null;
    hideTimer.current = window.setTimeout(() => setHoverId(null), HIDE_DELAY_MS);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const computePanelPos = useCallback((star: ConstellationStar): PanelPosition | null => {
    const svg = svgRef.current;
    const stage = stageRef.current;
    if (!svg || !stage) return null;

    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const point = svg.createSVGPoint();
    point.x = star.x;
    point.y = star.y;
    const screen = point.matrixTransform(ctm);
    const stageRect = stage.getBoundingClientRect();
    const x = screen.x - stageRect.left;
    const y = screen.y - stageRect.top;
    const offset = (star.radius + 8) * ctm.a + PANEL_GAP;

    let left = x + offset;
    if (left + PANEL_WIDTH > stageRect.width - 8) left = x - offset - PANEL_WIDTH;
    if (left < 8) left = 8;

    const top = Math.max(8, Math.min(y - 36, stageRect.height - PANEL_EST_HEIGHT - 8));
    return { left, top };
  }, []);

  useEffect(() => {
    if (!activeStar || isCoarse) {
      setPanelPos(null);
      return;
    }

    const update = () => setPanelPos(computePanelPos(activeStar));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeStar, computePanelPos, isCoarse]);

  const unpin = useCallback(
    (returnFocus: boolean) => {
      const id = pinnedId;
      setPinnedId(null);
      setHoverId(null);
      if (returnFocus && id !== null) starRefs.current.get(id)?.focus();
    },
    [pinnedId],
  );

  const activate = useCallback(
    (id: number) => {
      clearTimers();
      setHoverId(id);
      setPinnedId(id);
      window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus(), 0);
    },
    [clearTimers],
  );

  useEffect(() => {
    if (pinnedId === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") unpin(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".obs-star")) return;
      unpin(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pinnedId, unpin]);

  const bezelTicks = Array.from({ length: 60 }, (_, index) => {
    const degrees = index * 6;
    const radians = (degrees * Math.PI) / 180;
    const inner = BEZEL_RADIUS - (index % 5 === 0 ? 3.5 : 1.8);
    return {
      key: degrees,
      x1: round3(Math.cos(radians) * inner),
      y1: round3(Math.sin(radians) * inner),
      x2: round3(Math.cos(radians) * BEZEL_RADIUS),
      y2: round3(Math.sin(radians) * BEZEL_RADIUS),
    };
  });

  return (
    <div
      ref={stageRef}
      className="relative"
      onClick={() => {
        if (pinnedId !== null) unpin(false);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}`}
        className="mx-auto h-auto w-full max-w-[480px]"
        role="group"
        aria-label={`${planTitle} 별자리. 별 ${layout.stars.length}개 중 ${doneCount}개 완료. 각 별은 버튼입니다.`}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const radians = (index * 30 * Math.PI) / 180;
          return (
            <line
              key={index}
              x1={round3(Math.cos(radians) * 6)}
              y1={round3(Math.sin(radians) * 6)}
              x2={round3(Math.cos(radians) * (BEZEL_RADIUS - 4))}
              y2={round3(Math.sin(radians) * (BEZEL_RADIUS - 4))}
              stroke="#E8E8E2"
              strokeWidth={0.35}
            />
          );
        })}

        {bezelTicks.map((tick) => (
          <line key={tick.key} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke="#D2D2CB" strokeWidth={0.4} />
        ))}
        <circle cx={0} cy={0} r={BEZEL_RADIUS} fill="none" stroke="#E8E8E2" strokeWidth={0.5} />
        {(
          [
            { deg: 0, x: BEZEL_RADIUS + 3, y: 1.6, anchor: "start" },
            { deg: 90, x: 0, y: BEZEL_RADIUS + 7, anchor: "middle" },
            { deg: 180, x: -BEZEL_RADIUS - 3, y: 1.6, anchor: "end" },
            { deg: 270, x: 0, y: -BEZEL_RADIUS - 4, anchor: "middle" },
          ] as const
        ).map((mark) => (
          <text
            key={mark.deg}
            x={mark.x}
            y={mark.y}
            textAnchor={mark.anchor}
            fontSize={4}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            fill="#999992"
          >
            {mark.deg}°
          </text>
        ))}

        {nextPlan &&
          (() => {
            const radians = Math.PI / 4;
            const startRadius = BEZEL_RADIUS + 5;
            const endRadius = 150;
            const x0 = round3(Math.cos(radians) * startRadius);
            const y0 = round3(Math.sin(radians) * startRadius);
            const x1 = round3(Math.cos(radians) * endRadius);
            const y1 = round3(Math.sin(radians) * endRadius);
            return (
              <g>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#11110F" strokeWidth={0.6} strokeDasharray="1.5 2" />
                <polygon points={`${x1},${y1} ${x1 - 3.6},${y1 - 0.8} ${x1 - 0.8},${y1 - 3.6}`} fill="#11110F" />
                <text
                  x={x0 + 4}
                  y={y0 - 1}
                  fontSize={3.8}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  fill="#666660"
                  transform={`rotate(45 ${x0 + 4} ${y0 - 1})`}
                >
                  NEXT · {nextPlan.title.length > 14 ? `${nextPlan.title.slice(0, 14)}…` : nextPlan.title}
                </text>
              </g>
            );
          })()}

        {layout.orbitRadii.map((radius, index) => (
          <circle
            key={radius}
            cx={0}
            cy={0}
            r={radius}
            fill="none"
            stroke="#E8E8E2"
            strokeWidth={0.5}
            strokeDasharray={index === layout.orbitRadii.length - 1 ? "1 5" : "1 3.5"}
          />
        ))}

        {orbitDateLabels?.map((iso, index) => (
          <text
            key={index}
            x={2}
            y={-layout.orbitRadii[index] - 2}
            fontSize={4.5}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            fill="#999992"
          >
            {shortDate(iso)}
          </text>
        ))}

        {layout.connections.map((connection, index) => {
          const length = round3(Math.hypot(connection.to.x - connection.from.x, connection.to.y - connection.from.y));
          return (
            <line
              key={index}
              x1={connection.from.x}
              y1={connection.from.y}
              x2={connection.to.x}
              y2={connection.to.y}
              stroke="#11110F"
              strokeOpacity={0.55}
              strokeWidth={0.4}
              className="doit-line-draw"
              style={{ strokeDasharray: length, "--doit-line-length": length } as CSSProperties}
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
          <InteractiveStar
            key={star.id}
            star={star}
            active={activeId === star.id}
            pinned={pinnedId === star.id}
            onEnter={() => {
              if (!isCoarse) scheduleShow(star.id);
            }}
            onLeave={() => {
              if (pinnedId === null) scheduleHide();
            }}
            onActivate={() => activate(star.id)}
            nodeRef={(element) => {
              if (element) starRefs.current.set(star.id, element);
              else starRefs.current.delete(star.id);
            }}
          />
        ))}
      </svg>

      {activeStar && panelPos && !isCoarse && (
        <div
          ref={panelRef}
          role={pinnedId !== null ? "dialog" : "tooltip"}
          aria-label={`${activeStar.title} 상세`}
          className="obs-inspector absolute z-20 rounded-2xl p-4"
          style={{ left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH }}
          onMouseEnter={() => {
            if (hideTimer.current) window.clearTimeout(hideTimer.current);
            hideTimer.current = null;
          }}
          onMouseLeave={() => {
            if (pinnedId === null) scheduleHide();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <StarInspectorBody
            star={activeStar}
            index={indexById.get(activeStar.id) ?? 0}
            onClose={pinnedId !== null ? () => unpin(true) : undefined}
          />
        </div>
      )}

      {isCoarse && pinnedId !== null && activeStar && (
        <>
          <button type="button" aria-label="닫기" className="fixed inset-0 z-30 cursor-default bg-transparent" onClick={() => unpin(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${activeStar.title} 상세`}
            className="obs-sheet fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-ink-900/15 bg-[#F5F5F1]/90 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_32px_-12px_rgba(17,17,15,0.3)] backdrop-blur-md backdrop-saturate-150"
          >
            <StarInspectorBody star={activeStar} index={indexById.get(activeStar.id) ?? 0} onClose={() => unpin(true)} />
          </div>
        </>
      )}
    </div>
  );
}
