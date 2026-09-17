import Link from "next/link";

export function StatCard({
  href,
  label,
  value,
  coord,
}: {
  href: string;
  label: string;
  value: string;
  /** small coordinate-style tag, e.g. "01" or "EST." */
  coord?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-ink-900 focus-visible:border-ink-900"
    >
      <span className="label-coord flex items-center justify-between text-[10px] text-ink-400 group-hover:text-ink-700">
        <span>{label}</span>
        {coord && <span>{coord}</span>}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-ink-900">{value}</span>
      <span className="label-coord text-[10px] text-ink-400 group-hover:text-ink-700">
        근거 보기 →
      </span>
    </Link>
  );
}
