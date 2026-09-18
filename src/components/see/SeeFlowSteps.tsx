import { Fragment } from "react";

const STEPS = [
  { key: "PLAN", label: "계획 설정" },
  { key: "DO", label: "실행 기록" },
  { key: "SEE", label: "차이와 개선 확인" },
] as const;

/** The PLAN → DO → SEE cycle indicator, with the current step (always SEE, since
 * this only appears on the SEE screen) emphasized in solid ink. Horizontal on
 * desktop, stacked vertically on mobile.
 *
 * The arrow between two boxes is its own flex sibling (a separate <li>), not
 * nested inside either neighboring box's <li> -- nesting it put the arrow flush
 * against one box's edge instead of centered in the gap between the two. */
export function SeeFlowSteps() {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
      {STEPS.map((step, i) => {
        const current = step.key === "SEE";
        return (
          <Fragment key={step.key}>
            <li className="sm:flex-1">
              <div
                className={`flex flex-col items-start gap-1 border px-4 py-3 ${
                  current ? "border-ink-900" : "border-line"
                }`}
              >
                <span
                  className={`label-coord text-[11px] ${current ? "font-bold text-ink-900" : "text-ink-400"}`}
                  aria-current={current ? "step" : undefined}
                >
                  {step.key}
                </span>
                <span className={`text-sm ${current ? "font-medium text-ink-900" : "text-ink-500"}`}>{step.label}</span>
              </div>
            </li>
            {i < STEPS.length - 1 && (
              <li aria-hidden="true" className="hidden shrink-0 items-center justify-center px-3 text-ink-400 sm:flex">
                →
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
