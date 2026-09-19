import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// First line of defense only -- redirects a signed-out browser away from a data
// screen before it renders. Every one of these routes (and their Server Actions)
// re-checks the real session server-side; this never substitutes for that check.
//
// /dashboard is intentionally NOT in this list: its zero-plans empty state carries
// no user data, so src/app/dashboard/page.tsx itself decides what to render for a
// signed-out visitor instead of being redirected before it ever runs. This is a
// deliberate deviation from CLAUDE.md's "미인증 화면은 redirect" default -- see
// docs/T07_AUTH_IMPLEMENTATION.md's scope-decisions section.
const PROTECTED_PREFIXES = ["/plans", "/tasks", "/do", "/see", "/mypage"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isProtected) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/plans/:path*", "/tasks/:path*", "/do/:path*", "/see/:path*", "/mypage/:path*"],
};
