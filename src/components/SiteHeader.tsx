"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";

const TABS = [
  { href: "/dashboard", label: "HOME" },
  { href: "/plans", label: "PLAN" },
  { href: "/do", label: "DO" },
  { href: "/see", label: "SEE" },
];

export function SiteHeader({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  // Signed out: only HOME (the public demo gate) is a real destination, so PLAN/DO/SEE
  // aren't shown as live menu items at all -- clicking a tab is not how a signed-out
  // visitor learns those screens require login; the tabs simply aren't there.
  const visibleTabs = userEmail
    ? TABS
    : TABS.filter((tab) => tab.href === "/dashboard");

  return (
    <header className="border-b border-line bg-paper">
      {/* Same max-width/gutter scale as <main> (layout.tsx) so the logo lines up with
          where page content actually starts, instead of the header running wider. */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-10 min-[1200px]:px-12">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-ink-900">
            DO:IT
          </span>
          <span className="label-coord text-[10px] text-ink-400">
            PLAN YOUR ORBIT.
          </span>
        </Link>

        <nav
          aria-label="주요 화면 이동"
          className="flex flex-wrap items-center gap-0 text-sm"
        >
          {visibleTabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="label-coord relative flex min-h-[32px] w-[52px] items-center justify-center px-3 text-[11px] text-ink-500 transition-colors hover:text-ink-900"
              >
                <span className={active ? "text-ink-900" : undefined}>
                  {tab.label}
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-[13px] h-[2px] bg-ink-900"
                  />
                )}
              </Link>
            );
          })}
          <span
            className="mx-1 hidden h-4 w-px bg-line sm:inline-block"
            aria-hidden="true"
          />
          {userEmail ? (
            <>
              <Link
                href="/mypage"
                aria-current={pathname === "/mypage" ? "page" : undefined}
                className="label-coord flex min-h-[32px] items-center px-3 text-[11px] text-ink-500 transition-colors hover:text-ink-900"
              >
                MY
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="label-coord flex min-h-[32px] items-center px-3 text-[11px] text-ink-500 transition-colors hover:text-ink-900"
            >
              LOGIN
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
