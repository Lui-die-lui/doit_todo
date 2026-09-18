"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ConstellationLayout } from "@/lib/constellation";
import { formatDateTimeSeoul, minutesToLabel } from "@/lib/date";
import { Observatory, type HomeRecentLog, type ObservatoryPlan, type ObservatoryStats } from "./Observatory";
import { HomeTaskList, type HomeTaskRow } from "./HomeTaskList";

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
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between border-b border-ink-900 pb-2">
            <h2 id="home-do-heading" className="label-coord text-[11px] text-ink-900">
              DO / 최근 실행 기록
            </h2>
            <Link href="/do" className="label-coord text-[10px] text-ink-500 hover:text-ink-900">
              전체 기록 →
            </Link>
          </div>
          {slide.recentLogs.length === 0 ? (
            <p className="border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-400">
              아직 실행 기록이 없습니다. 첫 기록을 남기면 별 주변에 작은 궤적이 생깁니다.
            </p>
          ) : (
            <ul className="flex flex-col border-l border-line-strong pl-4">
              {slide.recentLogs.map((log) => (
                <li key={log.id} className="relative border-b border-line py-3 text-sm last:border-b-0">
                  <span aria-hidden="true" className="absolute -left-[20.5px] top-[1.1rem] h-2 w-2 rounded-full border border-ink-900 bg-surface" />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-mono text-xs text-ink-900">
                      {formatDateTimeSeoul(log.startAt)} – {formatDateTimeSeoul(log.endAt).slice(11)}
                    </span>
                    <span className="font-mono font-semibold text-ink-900">{minutesToLabel(log.actualMinutes)}</span>
                  </div>
                  <p className="mt-0.5 text-ink-700">
                    <Link href={`/tasks/${log.taskId}`} className="underline underline-offset-2">
                      {log.taskTitle}
                    </Link>
                  </p>
                  {log.blockerReason && (
                    <p className="mt-1 border-l-2 border-dashed border-ink-500 pl-2 text-sm text-ink-700">
                      <span className="label-coord mr-1 text-[9px] text-ink-400">BLOCKED</span>
                      {log.blockerReason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="border-b border-ink-900 pb-2">
            <h2 className="label-coord text-[11px] text-ink-900">SEE / 예상 대 실제</h2>
          </div>
          <dl className="flex flex-col gap-2 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="label-coord text-[10px] text-ink-400">EST.</dt>
              <dd className="text-ink-900">{minutesToLabel(slide.estimatedMinutesTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="label-coord text-[10px] text-ink-400">ACTUAL</dt>
              <dd className="text-ink-900">{minutesToLabel(slide.actualMinutesTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="label-coord text-[10px] text-ink-400">DIFF</dt>
              <dd className="font-semibold text-ink-900">
                {slide.diffMinutes > 0 ? "+" : ""}
                {minutesToLabel(slide.diffMinutes)}
              </dd>
            </div>
          </dl>
          <Link
            href={`/see?planId=${slide.plan.id}`}
            className="label-coord rounded-sm border border-line-strong px-4 py-2.5 text-center text-[11px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
          >
            SEE / 돌아보기 열기 →
          </Link>
        </aside>
      </section>
    </div>
  );
}
