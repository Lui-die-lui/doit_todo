"use client";

import { useRef, useState } from "react";
import type { ConstellationLayout } from "@/lib/constellation";
import { Observatory, type HomeRecentLog, type ObservatoryPlan, type ObservatoryStats } from "./Observatory";
import { HomeTaskList, type HomeTaskRow } from "./HomeTaskList";
import { RecentLogsPanel } from "./RecentLogsPanel";
import { EstimateVsActualPanel } from "./EstimateVsActualPanel";

export type { HomeRecentLog };

export type HomeSlide = {
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
};

const SWIPE_DISTANCE_PX = 60;

/** Wraps the observatory hero (and the sections that describe "this plan") in a looping,
 * arrow + swipe navigable carousel across every active plan's constellation. */
export function HomeCarousel({
  slides,
  initialIndex,
  viewerName,
}: {
  slides: HomeSlide[];
  initialIndex: number;
  viewerName: string;
}) {
  const [index, setIndex] = useState(() => (slides.length ? Math.min(Math.max(initialIndex, 0), slides.length - 1) : 0));
  const count = slides.length;
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  if (count === 0) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);
  const slide = slides[index];

  return (
    <div className="flex flex-col gap-20">
      <div
        className="flex flex-col gap-4"
        onPointerDown={(e) => {
          dragStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (!start || count <= 1) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          // require a clearly-horizontal drag so vertical scroll/star taps are never hijacked
          if (Math.abs(dx) > SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
            go(dx < 0 ? index + 1 : index - 1);
          }
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        {count > 1 && (
          <>
            {/* Mobile/tablet: the stage has no room to flank with buttons, so this stays a
                plain text bar above the hero. Desktop swaps to glass buttons either side of
                the constellation itself (inside Observatory) -- this collapses to just the
                position readout, freeing the row for it. */}
            <div className="flex items-center justify-between lg:hidden">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="이전 계획 별자리 보기"
                className="label-coord rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
              >
                ‹ PREV
              </button>
              <p aria-live="polite" className="label-coord text-[10px] text-ink-400">
                CONSTELLATION {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="다음 계획 별자리 보기"
                className="label-coord rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
              >
                NEXT ›
              </button>
            </div>
            <p aria-live="polite" className="label-coord hidden text-center text-[10px] text-ink-400 lg:block">
              CONSTELLATION {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </p>
          </>
        )}

        <Observatory
          key={slide.plan.id}
          plan={slide.plan}
          layout={slide.layout}
          orbitDateLabels={slide.orbitDateLabels}
          stats={slide.stats}
          nextPlan={slide.nextPlan}
          taskRows={slide.taskRows}
          recentLogs={slide.recentLogs}
          estimatedMinutesTotal={slide.estimatedMinutesTotal}
          actualMinutesTotal={slide.actualMinutesTotal}
          diffMinutes={slide.diffMinutes}
          viewerName={viewerName}
          canNavigate={count > 1}
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
        />
      </div>

      {/* Desktop already carries this list inside the observatory hero's glass panel;
          this full-width version stays for mobile/tablet, where the hero stacks vertically. */}
      <section aria-labelledby="home-tasks-heading" className="flex flex-col gap-5 lg:hidden">
        <div className="flex items-baseline justify-between border-b border-ink-900 pb-2">
          <h2 id="home-tasks-heading" className="label-coord text-[11px] text-ink-900">
            TASKS / 이 계획의 할 일 ({slide.taskRows.length})
          </h2>
          <span className="label-coord text-[10px] text-ink-400">별자리와 같은 데이터 · 목록 보기</span>
        </div>
        <HomeTaskList key={slide.plan.id} tasks={slide.taskRows} planId={slide.plan.id} />
      </section>

      {/* Desktop already carries DO + SEE previews inside the observatory hero's top-right
          corner; this full-width version stays for mobile/tablet. */}
      <section aria-labelledby="home-do-heading" className="grid grid-cols-1 gap-8 lg:hidden">
        <RecentLogsPanel logs={slide.recentLogs} headingId="home-do-heading" />
        <EstimateVsActualPanel
          planId={slide.plan.id}
          estimatedMinutes={slide.estimatedMinutesTotal}
          actualMinutes={slide.actualMinutesTotal}
          diffMinutes={slide.diffMinutes}
        />
      </section>
    </div>
  );
}
