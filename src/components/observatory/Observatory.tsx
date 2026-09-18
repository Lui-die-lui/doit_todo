"use client";

import Link from "next/link";
import { MdNavigateBefore, MdNavigateNext } from "react-icons/md";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ConstellationLayout, ConstellationStar } from "@/lib/constellation";
import { describeStar, sizeTierForRadius } from "@/lib/constellation";
import { formatDateOnly, formatDateTimeSeoul, minutesToLabel, minutesToMonoLabel } from "@/lib/date";
import { priorityLabels } from "@/lib/validation";
import { doneStarImageRect, round3, sparklePath } from "@/components/constellation/starGeometry";
import { HomeTaskList, type HomeTaskRow } from "./HomeTaskList";

const VIEW = 116;
const BEZEL_RADIUS = 100;
const PANEL_WIDTH = 288;
const PANEL_GAP = 18;
const PANEL_EST_HEIGHT = 250;
const SHOW_DELAY_MS = 80;
const HIDE_DELAY_MS = 220;

export type ObservatoryPlan = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  successCriteria: string;
  estimatedMinutes: number;
};

export type ObservatoryStats = {
  planned: number;
  done: number;
  overdue: number;
  blocked: number;
  actualMinutes: number;
};

export type HomeRecentLog = {
  id: number;
  taskId: number;
  taskTitle: string;
  startAt: string;
  endAt: string;
  actualMinutes: number;
  blockerReason: string | null;
};

type PanelPosition = { left: number; top: number; side: "left" | "right"; starX: number; starY: number };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function shortDate(iso: string): string {
  return formatDateOnly(iso).slice(5);
}

function statusLabel(star: ConstellationStar): string {
  return star.status === "DONE" ? "완료" : star.isOverdue ? "지연" : star.workLogCount > 0 ? "진행 중" : "시작 전";
}

/* ------------------------------------------------------------------ */
/* Inspector content (shared by the floating panel and the mobile sheet) */
/* ------------------------------------------------------------------ */

function InspectorBody({ star, index, onClose }: { star: ConstellationStar; index: number; onClose?: () => void }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="label-coord text-[10px] text-ink-400">STAR / {pad2(index)}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="label-coord -mr-1 -mt-1 px-1.5 py-0.5 text-[10px] text-ink-500 hover:text-ink-900"
          >
            ESC ×
          </button>
        )}
      </div>
      <p className="break-words text-base font-semibold leading-snug text-ink-900">{star.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        <dt className="label-coord text-[10px] text-ink-400">STATUS</dt>
        <dd className="text-ink-900">{statusLabel(star)}</dd>
        <dt className="label-coord text-[10px] text-ink-400">DUE</dt>
        <dd className="text-ink-900">{formatDateOnly(star.dueDate)}</dd>
        <dt className="label-coord text-[10px] text-ink-400">PRIORITY</dt>
        <dd className="text-ink-900">{priorityLabels[star.priority]}</dd>
        <dt className="label-coord text-[10px] text-ink-400">TAG</dt>
        <dd className="text-ink-900">{star.tag ? `#${star.tag}` : "—"}</dd>
        <dt className="label-coord text-[10px] text-ink-400">EST / ACTUAL</dt>
        <dd className="text-ink-900">
          {minutesToLabel(star.estimatedMinutes)} / {minutesToLabel(star.actualMinutesTotal)}
        </dd>
        <dt className="label-coord text-[10px] text-ink-400">LOGS</dt>
        <dd className="text-ink-900">
          {star.workLogCount}건{star.hasBlocker ? " · 막힌 기록 있음" : ""}
        </dd>
      </dl>
      <Link
        href={`/tasks/${star.id}`}
        className="mt-1 inline-flex w-fit items-center gap-1 border-b border-ink-900 pb-0.5 text-sm font-medium text-ink-900"
      >
        할 일 열기 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One star node -- a keyboard-operable button inside the SVG           */
/* ------------------------------------------------------------------ */

function StarNode({
  star,
  active,
  pinned,
  onEnter,
  onLeave,
  onActivate,
  nodeRef,
}: {
  star: ConstellationStar;
  active: boolean;
  pinned: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onActivate: () => void;
  nodeRef: (el: SVGGElement | null) => void;
}) {
  const notStarted = star.status === "TODO" && star.workLogCount === 0;
  const sparkle = sparklePath(star.x, star.y, star.radius);

  const handleKey = (e: ReactKeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <g
      ref={nodeRef}
      role="button"
      tabIndex={0}
      aria-label={describeStar(star)}
      aria-expanded={pinned}
      data-active={active ? "true" : "false"}
      className="obs-star"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={handleKey}
    >
      {/* generous invisible hit target, independent of the visual size */}
      <circle cx={star.x} cy={star.y} r={Math.max(star.radius + 4, 10)} fill="transparent" />

      {active && (
        <g aria-hidden="true">
          <circle className="obs-ripple" cx={star.x} cy={star.y} r={star.radius + 2.5} fill="none" stroke="#666660" strokeWidth={0.5} />
          <circle className="obs-ripple obs-ripple--delay" cx={star.x} cy={star.y} r={star.radius + 2.5} fill="none" stroke="#666660" strokeWidth={0.5} />
        </g>
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

      {star.workLogCount > 0 &&
        Array.from({ length: Math.min(star.workLogCount, 8) }, (_, i) => {
          const count = Math.min(star.workLogCount, 8);
          const spread = 70;
          const deg = count === 1 ? -90 : -90 - spread / 2 + (spread / (count - 1)) * i;
          const rad = (deg * Math.PI) / 180;
          const r = star.radius + (star.hasBlocker ? 5.6 : 2.6);
          return (
            <circle key={i} cx={round3(star.x + Math.cos(rad) * r)} cy={round3(star.y + Math.sin(rad) * r)} r={0.7} fill="#666660" />
          );
        })}

      {star.status === "DONE" ? (
        (() => {
          const rect = doneStarImageRect(star.x, star.y, star.radius, sizeTierForRadius(star.radius));
          return (
            <image
              className="doit-star-reveal obs-star__body"
              href={rect.href}
              x={round3(rect.x)}
              y={round3(rect.y)}
              width={round3(rect.width)}
              height={round3(rect.height)}
            />
          );
        })()
      ) : notStarted ? (
        <circle className="obs-star__body" cx={star.x} cy={star.y} r={star.radius * 0.4} fill="#999992" fillOpacity={0.55} />
      ) : (
        <path className="obs-star__body obs-star__body--outline" d={sparkle} fill="none" stroke="#666660" strokeWidth={1} />
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* The observatory                                                      */
/* ------------------------------------------------------------------ */

export function Observatory({
  plan,
  layout,
  orbitDateLabels,
  stats,
  nextPlan,
  taskRows,
  recentLogs,
  estimatedMinutesTotal,
  actualMinutesTotal,
  diffMinutes,
  canNavigate = false,
  onPrev,
  onNext,
  viewerName,
}: {
  plan: ObservatoryPlan;
  layout: ConstellationLayout;
  orbitDateLabels: [string, string, string];
  stats: ObservatoryStats;
  nextPlan: { id: number; title: string } | null;
  taskRows: HomeTaskRow[];
  recentLogs: HomeRecentLog[];
  estimatedMinutesTotal: number;
  actualMinutesTotal: number;
  diffMinutes: number;
  /** Whether more than one plan is in the carousel -- gates the desktop flanking nav buttons. */
  canNavigate?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  /** The signed-in viewer's display name, for the "{name}님의 계획 별자리예요." caption --
   * this hero is only ever shown to its owner now (no public/guest link-sharing). */
  viewerName: string;
}) {
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const [isCoarse, setIsCoarse] = useState(false);
  const [taskPanelMaxH, setTaskPanelMaxH] = useState<number | null>(null);
  const [doSeeMaxH, setDoSeeMaxH] = useState<number | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<SVGGElement>(null);
  const parallaxOuterRef = useRef<SVGGElement>(null);
  const starRefs = useRef(new Map<number, SVGGElement>());
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const taskPanelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const doSeeRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDListElement>(null);

  const activeId = pinnedId ?? hoverId;
  const activeStar = activeId !== null ? layout.stars.find((s) => s.id === activeId) ?? null : null;
  const indexById = new Map(layout.stars.map((s, i) => [s.id, i + 1]));

  /* --- environment: coarse pointer (mobile) detection, post-mount only --- */
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (max-width: 640px)");
    const apply = () => setIsCoarse(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* --- desktop corner panels: clamp each to the actual pixel gap before the
     bottom-anchored corner below it, instead of guessing with a vh fraction --
     a short/ultrawide window can leave far less room than a typical 16:9 one. */
  useLayoutEffect(() => {
    const GAP = 24;
    const recompute = () => {
      if (window.innerWidth < 1024) return;
      if (taskPanelRef.current && actionsRef.current) {
        const room = actionsRef.current.getBoundingClientRect().top - taskPanelRef.current.getBoundingClientRect().top - GAP;
        setTaskPanelMaxH(Math.max(80, room));
      }
      if (doSeeRef.current && statsRef.current) {
        const room = statsRef.current.getBoundingClientRect().top - doSeeRef.current.getBoundingClientRect().top - GAP;
        setDoSeeMaxH(Math.max(80, room));
      }
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [taskRows.length, recentLogs.length]);

  /* --- timers --- */
  const clearTimers = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  const scheduleShow = useCallback(
    (id: number) => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
      showTimer.current = window.setTimeout(() => setHoverId(id), SHOW_DELAY_MS);
    },
    [],
  );

  const scheduleHide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = null;
    hideTimer.current = window.setTimeout(() => setHoverId(null), HIDE_DELAY_MS);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /* --- panel placement: viewBox -> stage pixels, flip near the right edge --- */
  const computePanelPos = useCallback((star: ConstellationStar): PanelPosition | null => {
    const svg = svgRef.current;
    const stage = stageRef.current;
    if (!svg || !stage) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = star.x;
    pt.y = star.y;
    const screen = pt.matrixTransform(ctm);
    const stageRect = stage.getBoundingClientRect();
    const x = screen.x - stageRect.left;
    const y = screen.y - stageRect.top;
    const scale = ctm.a;
    const offset = (star.radius + 8) * scale + PANEL_GAP;

    let side: "left" | "right" = "right";
    let left = x + offset;
    if (left + PANEL_WIDTH > stageRect.width - 8) {
      side = "left";
      left = x - offset - PANEL_WIDTH;
    }
    if (left < 8) left = 8;
    const top = Math.max(8, Math.min(y - 36, stageRect.height - PANEL_EST_HEIGHT - 8));
    return { left, top, side, starX: x, starY: y };
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
  }, [activeStar, isCoarse, computePanelPos]);

  /* --- pin / unpin --- */
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
      // move keyboard focus into the panel so its link is the next Tab stop
      window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus(), 0);
    },
    [clearTimers],
  );

  useEffect(() => {
    if (pinnedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") unpin(true);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
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

  /* --- pointer parallax on the decorative layers only (never on stars) --- */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = section.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        // ~1-3 screen px of drift: viewBox units here scale to roughly 2-3 px each
        if (parallaxRef.current) parallaxRef.current.style.transform = `translate(${nx * 0.6}px, ${ny * 0.6}px)`;
        if (parallaxOuterRef.current) parallaxOuterRef.current.style.transform = `translate(${nx * 1.1}px, ${ny * 1.1}px)`;
      });
    };
    const onLeave = () => {
      if (parallaxRef.current) parallaxRef.current.style.transform = "";
      if (parallaxOuterRef.current) parallaxOuterRef.current.style.transform = "";
    };
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const bezelTicks = Array.from({ length: 60 }, (_, i) => {
    const rad = (i * 6 * Math.PI) / 180;
    const inner = BEZEL_RADIUS - (i % 5 === 0 ? 3.5 : 1.8);
    return {
      key: i,
      x1: round3(Math.cos(rad) * inner),
      y1: round3(Math.sin(rad) * inner),
      x2: round3(Math.cos(rad) * BEZEL_RADIUS),
      y2: round3(Math.sin(rad) * BEZEL_RADIUS),
    };
  });

  const isComplete = layout.isComplete;
  const scopeParam = `plan:${plan.id}`;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="observatory-title"
      className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden"
    >
      <div className="relative mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-[1920px] flex-col px-5 pb-5 pt-6 sm:px-8 lg:block lg:pb-0 lg:pt-0">
        {/* ---------- top-left: plan ---------- */}
        <div className="order-1 max-w-md lg:absolute lg:left-8 lg:top-0 lg:z-10 lg:w-[22rem] lg:max-w-[22rem] lg:pointer-events-none">
          <p className="label-coord text-[10px] text-ink-400">CURRENT CONSTELLATION / {pad2(plan.id)}</p>
          <h1
            id="observatory-title"
            className="mt-1 break-words text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl lg:text-xl"
          >
            {plan.title}
          </h1>
          <p className="mt-2 font-mono text-xs text-ink-500 lg:mt-1 lg:text-[11px]">
            {formatDateOnly(plan.startDate)} — {formatDateOnly(plan.endDate)} · {priorityLabels[plan.priority]}
          </p>
          <p className="mt-3 line-clamp-3 max-w-xs text-sm leading-relaxed text-ink-700 lg:mt-1.5 lg:text-xs">
            {plan.successCriteria}
          </p>
          <div className="mt-3 h-px w-12 bg-ink-900 lg:mt-2" aria-hidden="true" />
          <p className="mt-2 font-mono text-xs text-ink-500 lg:mt-1.5 lg:text-[11px]">
            EST. {minutesToMonoLabel(plan.estimatedMinutes)} · 예상 {minutesToLabel(plan.estimatedMinutes)}
          </p>
          <p className="mt-1 label-coord text-[11px] text-ink-900">
            {isComplete ? "CONSTELLATION COMPLETE" : `${pad2(stats.done)} / ${pad2(stats.planned)} STARS LIT`}
          </p>

          {/* Task list, embedded as a glass panel below the fold-free hero (desktop only --
              on mobile the hero stacks vertically already, so the full-width section below still
              carries it). Its scroll area is clamped to the measured gap above the bottom-left
              buttons (see the resize effect above) so it can never overlap them, whatever the
              window's height or aspect ratio. */}
          <div
            ref={taskPanelRef}
            className="obs-task-panel pointer-events-auto mt-4 hidden flex-col overflow-hidden rounded-2xl border border-ink-900/15 bg-[#F5F5F1]/80 shadow-[0_12px_32px_-12px_rgba(17,17,15,0.3)] backdrop-blur-md backdrop-saturate-150 lg:mt-3 lg:flex"
            style={{ maxHeight: taskPanelMaxH ?? 240 }}
          >
            <div className="flex shrink-0 items-baseline justify-between border-b border-ink-900/10 px-4 pb-2 pt-3">
              <h2 className="label-coord text-xs text-ink-900">TASKS / 할 일 ({taskRows.length})</h2>
              <Link href="/tasks" className="label-coord text-[11px] text-ink-400 hover:text-ink-900">
                전체 →
              </Link>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
              <HomeTaskList tasks={taskRows} planId={plan.id} compact />
            </div>
          </div>
        </div>

        {/* ---------- top-right: observer ---------- */}
        <div className="order-5 mt-4 border-t border-line pt-2 text-right lg:absolute lg:right-8 lg:top-0 lg:z-10 lg:mt-0 lg:w-72 lg:border-0 lg:pt-0 lg:pointer-events-none">
          <p className="label-coord text-[10px] text-ink-400">PRIVATE</p>
          <p className="mt-1 label-coord text-[11px] text-ink-900">MY VIEW</p>
          <p className="ml-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-ink-500 lg:text-[11px]">
            {viewerName}님의 계획 별자리예요.
          </p>

          {/* DO + SEE preview, plain (no glass panel) -- fills the empty vertical space between
              the observer text and the bottom-right stat readout, desktop only. Mirrors the
              full-width DO/SEE section below, which stays for mobile/tablet. Clamped + scrollable
              to the measured gap above the stats readout, same as the task panel on the left. */}
          <div
            ref={doSeeRef}
            className="pointer-events-auto mt-8 hidden overflow-y-auto text-left lg:mt-5 lg:block"
            style={{ maxHeight: doSeeMaxH ?? 420 }}
          >
            <div className="flex items-baseline justify-between border-b border-ink-900 pb-2">
              <h2 className="label-coord text-[11px] text-ink-900">DO / 최근 실행 기록</h2>
              <Link href="/do" className="label-coord text-[10px] text-ink-500 hover:text-ink-900">
                전체 기록 →
              </Link>
            </div>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-xs text-ink-400 lg:text-[11px]">아직 실행 기록이 없습니다.</p>
            ) : (
              <ul className="flex flex-col border-l border-line-strong pl-4">
                {recentLogs.slice(0, 3).map((log) => (
                  <li key={log.id} className="relative border-b border-line py-2.5 text-sm last:border-b-0 lg:py-2 lg:text-xs">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[18.5px] top-[0.95rem] h-1.5 w-1.5 rounded-full border border-ink-900 bg-surface"
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-mono text-[11px] text-ink-900 lg:text-[10px]">
                        {formatDateTimeSeoul(log.startAt)} – {formatDateTimeSeoul(log.endAt).slice(11)}
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink-900 lg:text-[11px]">
                        {minutesToLabel(log.actualMinutes)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-700 lg:text-[11px]">
                      <Link href={`/tasks/${log.taskId}`} className="underline underline-offset-2">
                        {log.taskTitle}
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 border-b border-ink-900 pb-2 lg:mt-4">
              <h2 className="label-coord text-[11px] text-ink-900">SEE / 예상 대 실제</h2>
            </div>
            <dl className="mt-2 flex flex-col gap-1.5 font-mono text-xs lg:text-[11px]">
              <div className="flex justify-between gap-4">
                <dt className="label-coord text-[10px] text-ink-400">EST.</dt>
                <dd className="text-ink-900">{minutesToLabel(estimatedMinutesTotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="label-coord text-[10px] text-ink-400">ACTUAL</dt>
                <dd className="text-ink-900">{minutesToLabel(actualMinutesTotal)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-1.5">
                <dt className="label-coord text-[10px] text-ink-400">DIFF</dt>
                <dd className="font-semibold text-ink-900">
                  {diffMinutes > 0 ? "+" : ""}
                  {minutesToLabel(diffMinutes)}
                </dd>
              </div>
            </dl>
            <Link
              href={`/see?planId=${plan.id}`}
              className="label-coord mt-3 block rounded-sm border border-line-strong px-4 py-2 text-center text-[10px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
            >
              SEE / 돌아보기 열기 →
            </Link>
          </div>
        </div>

        {/* ---------- center: the star field (page background, no card) ---------- */}
        {/* lg:pl/pr reserve exactly the space the absolutely-positioned corners claim
            (left-8 + 22rem, right-8 + 18rem -- see those blocks above) so the flanking nav
            buttons below, centered within this box, never land underneath them. */}
        <div
          ref={stageRef}
          className="relative order-2 mx-auto mt-6 w-full max-w-[min(92vw,calc(100svh-14rem))] lg:mt-0 lg:flex lg:min-h-[calc(100svh-8.5rem)] lg:max-w-none lg:items-center lg:justify-center lg:pl-[24rem] lg:pr-[20rem]"
          onClick={() => {
            if (pinnedId !== null) unpin(false);
          }}
        >
          {canNavigate && onPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              aria-label="이전 계획 별자리 보기"
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink-900/15 bg-[#F5F5F1]/70 text-ink-700 shadow-[0_8px_24px_-10px_rgba(17,17,15,0.35)] backdrop-blur-md backdrop-saturate-150 transition-colors hover:bg-[#E4E4DD] hover:text-ink-900 focus:outline-none focus-visible:bg-[#E4E4DD] focus-visible:text-ink-900 lg:flex"
            >
              <MdNavigateBefore aria-hidden="true" size={26} />
            </button>
          )}

          <svg
            ref={svgRef}
            viewBox={`-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}`}
            className="mx-auto h-auto w-full lg:w-[min(52vw,calc(100svh-10rem))]"
            role="group"
            aria-label={`${plan.title} 별자리, 할 일 ${layout.stars.length}개 중 ${stats.done}개 완료. 각 별은 버튼입니다.`}
          >
            {/* decorative layers drift with the pointer; star coordinates never move */}
            <g ref={parallaxOuterRef} className="obs-parallax">
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
                <text key={m.deg} x={m.x} y={m.y} textAnchor={m.anchor} fontSize={4} fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fill="#999992">
                  {m.deg}°
                </text>
              ))}
            </g>

            <g ref={parallaxRef} className="obs-parallax">
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
              {layout.orbitRadii.map((r, i) => (
                <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#E8E8E2" strokeWidth={0.5} strokeDasharray={i === 2 ? "1 5" : "1 3.5"} />
              ))}
              {orbitDateLabels.map((iso, i) => (
                <text key={i} x={2} y={-layout.orbitRadii[i] - 2} fontSize={4.5} fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fill="#999992">
                  {shortDate(iso)}
                </text>
              ))}
            </g>

            {nextPlan &&
              (() => {
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
                    <polygon points={`${x1},${y1} ${x1 - 3.6},${y1 - 0.8} ${x1 - 0.8},${y1 - 3.6}`} fill="#11110F" />
                    <text x={x0 + 4} y={y0 - 1} fontSize={3.8} fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fill="#666660" transform={`rotate(45 ${x0 + 4} ${y0 - 1})`}>
                      NEXT → {nextPlan.title.length > 14 ? `${nextPlan.title.slice(0, 14)}…` : nextPlan.title}
                    </text>
                  </g>
                );
              })()}

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
                  style={{ strokeDasharray: length, ["--doit-line-length" as string]: length } as CSSProperties}
                />
              );
            })}

            <circle cx={0} cy={0} r={isComplete ? 3.6 : 2} fill={isComplete ? "#11110F" : "none"} stroke="#11110F" strokeWidth={1} />

            {layout.stars.map((star) => (
              <StarNode
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
                nodeRef={(el) => {
                  if (el) starRefs.current.set(star.id, el);
                  else starRefs.current.delete(star.id);
                }}
              />
            ))}
          </svg>

          {canNavigate && onNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="다음 계획 별자리 보기"
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink-900/15 bg-[#F5F5F1]/70 text-ink-700 shadow-[0_8px_24px_-10px_rgba(17,17,15,0.35)] backdrop-blur-md backdrop-saturate-150 transition-colors hover:bg-[#E4E4DD] hover:text-ink-900 focus:outline-none focus-visible:bg-[#E4E4DD] focus-visible:text-ink-900 lg:flex"
            >
              <MdNavigateNext aria-hidden="true" size={26} />
            </button>
          )}

          {/* ---------- floating inspector (desktop) ---------- */}
          {activeStar && panelPos && !isCoarse && (
            <div
              ref={panelRef}
              role={pinnedId !== null ? "dialog" : "tooltip"}
              aria-label={`${activeStar.title} 상세`}
              className="obs-inspector absolute z-20 rounded-2xl border border-ink-900/15 bg-[#F5F5F1]/85 p-4 shadow-[0_12px_32px_-12px_rgba(17,17,15,0.35)] backdrop-blur-md backdrop-saturate-150"
              style={{ left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH }}
              onMouseEnter={() => {
                if (hideTimer.current) window.clearTimeout(hideTimer.current);
                hideTimer.current = null;
              }}
              onMouseLeave={() => {
                if (pinnedId === null) scheduleHide();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <InspectorBody star={activeStar} index={indexById.get(activeStar.id) ?? 0} onClose={pinnedId !== null ? () => unpin(true) : undefined} />
            </div>
          )}
        </div>

        {/* ---------- bottom-left: primary actions ---------- */}
        <div ref={actionsRef} className="order-4 mt-6 flex flex-wrap gap-2 lg:absolute lg:bottom-8 lg:left-8 lg:z-10 lg:mt-0">
          <Link href="/do" className="inline-flex items-center gap-2 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
            실행 기록 남기기 <span aria-hidden="true">→</span>
          </Link>
          <Link href={`/plans/${plan.id}`} className="inline-flex items-center rounded-sm border border-ink-900 bg-surface px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-surface-muted">
            현재 계획 보기
          </Link>
        </div>

        {/* ---------- bottom-right: observation readout (each value links to its evidence) ---------- */}
        <dl
          ref={statsRef}
          className="order-3 mt-6 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs sm:flex sm:flex-wrap sm:gap-x-8 lg:absolute lg:bottom-8 lg:right-8 lg:z-10 lg:mt-0 lg:flex-col lg:items-end lg:gap-y-1.5 lg:text-right"
        >
          {(
            [
              { key: "done", label: "LIT", value: `${pad2(stats.done)} / ${pad2(stats.planned)}` },
              { key: "overdue", label: "DELAYED", value: pad2(stats.overdue) },
              { key: "blocked", label: "BLOCKED", value: pad2(stats.blocked) },
              { key: "actual", label: "ACTUAL", value: minutesToMonoLabel(stats.actualMinutes) },
            ] as const
          ).map((row) => (
            <div key={row.key} className="flex items-baseline gap-2 lg:justify-end">
              <dt className="label-coord text-[10px] text-ink-400">{row.label}</dt>
              <dd>
                <Link
                  href={`/see/evidence?scope=${encodeURIComponent(scopeParam)}&metric=${row.key}`}
                  className="border-b border-transparent text-ink-900 hover:border-ink-900"
                  title="근거 기록 보기"
                >
                  {row.value}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---------- mobile: bottom sheet ---------- */}
      {isCoarse && pinnedId !== null && activeStar && (
        <>
          <button type="button" aria-label="닫기" className="fixed inset-0 z-30 cursor-default bg-transparent" onClick={() => unpin(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${activeStar.title} 상세`}
            className="obs-sheet fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-ink-900/15 bg-[#F5F5F1]/90 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_32px_-12px_rgba(17,17,15,0.3)] backdrop-blur-md backdrop-saturate-150"
          >
            <InspectorBody star={activeStar} index={indexById.get(activeStar.id) ?? 0} onClose={() => unpin(true)} />
          </div>
        </>
      )}
    </section>
  );
}
