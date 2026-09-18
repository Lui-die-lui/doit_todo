"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/plans", label: "PLAN" },
  { href: "/do", label: "DO" },
  { href: "/see", label: "SEE" },
];

export function SiteHeader() {
  const pathname = usePathname();
  // The home observatory hero breaks out to a wider canvas than every other page's
  // max-w-6xl column -- match the header's edges to whichever is actually below it,
  // rather than one fixed width that lines up with only one of the two.
  const isHome = pathname === "/";

  return (
    <header className="border-b border-line bg-paper">
      <div
        className={`mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 ${
          isHome ? "max-w-[1920px] px-5 sm:px-8" : "max-w-6xl px-4 sm:px-6"
        }`}
      >
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-ink-900">DO:IT</span>
          <span className="label-coord text-[10px] text-ink-400">PLAN · DO · SEE</span>
        </Link>

        <nav aria-label="주요 화면 이동" className="flex items-center gap-1 text-sm">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="label-coord relative px-3 py-2 text-[11px] text-ink-500 transition-colors hover:text-ink-900"
              >
                <span className={active ? "text-ink-900" : undefined}>{tab.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-[1px] h-[2px] bg-ink-900"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
