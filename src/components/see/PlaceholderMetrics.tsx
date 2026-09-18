const PLACEHOLDER_METRICS = ["계획 시간", "실제 시간", "수행률", "다음 개선점"] as const;

/** Faded preview of the metric grid SEE will show once there's data to compare --
 * labels only, no numbers (real or fake) so it never reads as an actual result. */
export function PlaceholderMetrics() {
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line opacity-50 sm:grid-cols-4">
      {PLACEHOLDER_METRICS.map((label) => (
        <div key={label} className="flex flex-col gap-2 bg-surface px-4 py-5">
          <span className="label-coord text-[10px] text-ink-400">{label}</span>
          <span className="font-mono text-lg text-ink-400" aria-hidden="true">
            —
          </span>
        </div>
      ))}
    </div>
  );
}
