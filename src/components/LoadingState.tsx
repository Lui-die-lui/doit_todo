export function LoadingState({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[calc(100svh-12rem)] flex-col items-center justify-center gap-3 text-sm text-ink-400"
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-ink-400/30 border-t-ink-700"
      />
      <span>{label}</span>
    </div>
  );
}
