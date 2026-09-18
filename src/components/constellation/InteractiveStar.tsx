"use client";

import Link from "next/link";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ConstellationStar } from "@/lib/constellation";
import { describeStar, sizeTierForRadius } from "@/lib/constellation";
import { formatDateOnly, minutesToLabel } from "@/lib/date";
import { priorityLabels } from "@/lib/validation";
import { doneStarImageRect, round3, sparklePath } from "./starGeometry";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function statusLabel(star: ConstellationStar): string {
  return star.status === "DONE" ? "완료" : star.isOverdue ? "지연" : star.workLogCount > 0 ? "진행 중" : "시작 전";
}

export function StarInspectorBody({
  star,
  index,
  onClose,
}: {
  star: ConstellationStar;
  index: number;
  onClose?: () => void;
}) {
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
        className="mt-1 inline-flex w-fit self-end items-center gap-1 rounded-full bg-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:bg-ink-900/15"
      >
        할 일 열기 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function InteractiveStar({
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

  const handleKey = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
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
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      onKeyDown={handleKey}
    >
      <circle cx={star.x} cy={star.y} r={Math.max(star.radius + 4, 10)} fill="transparent" />

      {active && (
        <g aria-hidden="true">
          <circle className="obs-ripple" cx={star.x} cy={star.y} r={star.radius + 2.5} fill="none" stroke="#B8B8B0" strokeWidth={0.5} />
          <circle className="obs-ripple obs-ripple--delay" cx={star.x} cy={star.y} r={star.radius + 2.5} fill="none" stroke="#B8B8B0" strokeWidth={0.5} />
        </g>
      )}

      {star.hasBlocker && (
        <circle
          cx={star.x}
          cy={star.y}
          r={star.radius + 3.2}
          fill="none"
          stroke="#666660"
          strokeWidth={0.2}
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
