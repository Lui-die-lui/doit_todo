import type { ReactNode } from "react";

/** Shared page-header shell for PLAN/DO/SEE: eyebrow + big title + one-line
 * description on the left, the screen's primary action(s) on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-2">
        <p className="label-coord text-[11px] text-ink-400 sm:text-xs">{eyebrow}</p>
        <h1 className="text-[26px] font-bold leading-tight text-ink-900 sm:text-[32px]">{title}</h1>
        {description && <p className="max-w-xl text-sm text-ink-500 sm:text-base">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
