import type { ReactNode } from "react";

/**
 * Status is never color-coded here -- only ink/paper contrast, fill vs.
 * outline, and solid vs. dashed lines distinguish states, per the
 * observation-chart design language (see DESIGN.md-equivalent brief).
 */

const PRIORITY_GLYPH: Record<string, string> = {
  HIGH: "▲",
  MEDIUM: "●",
  LOW: "▽",
};

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

const PRIORITY_WEIGHT: Record<string, string> = {
  HIGH: "font-semibold",
  MEDIUM: "font-medium",
  LOW: "font-normal",
};

export function PriorityBadge({ priority }: { priority: "HIGH" | "MEDIUM" | "LOW" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border border-line-strong px-2 py-0.5 text-xs text-ink-700 ${PRIORITY_WEIGHT[priority]}`}
    >
      <span aria-hidden="true">{PRIORITY_GLYPH[priority]}</span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusPill({
  children,
  variant = "outline",
}: {
  children: ReactNode;
  variant?: "filled" | "outline" | "dashed" | "muted";
}) {
  const variantClass: Record<string, string> = {
    filled: "border-ink-900 bg-ink-900 text-white",
    outline: "border-line-strong bg-surface text-ink-700",
    dashed: "border-dashed border-ink-500 bg-surface text-ink-700",
    muted: "border-line bg-surface-muted text-ink-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs ${variantClass[variant]}`}
    >
      {children}
    </span>
  );
}

export function TaskStatusBadge({
  status,
  overdue,
}: {
  status: "TODO" | "DONE";
  overdue: boolean;
}) {
  if (status === "DONE") {
    return (
      <StatusPill variant="filled">
        <span aria-hidden="true">★</span> 완료
      </StatusPill>
    );
  }
  if (overdue) {
    return (
      <StatusPill variant="dashed">
        <span aria-hidden="true">/</span> 지연
      </StatusPill>
    );
  }
  return (
    <StatusPill variant="outline">
      <span aria-hidden="true">○</span> 진행 중
    </StatusPill>
  );
}
