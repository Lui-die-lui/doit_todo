export function LoadingState({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border border-dashed border-line-strong bg-surface p-10 text-sm text-ink-400"
    >
      <span
        aria-hidden="true"
        className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-ink-400/40 border-t-ink-700"
      />
      {label}
    </div>
  );
}
