import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "DO:IT — 내 플랜 이어보기",
  description: "계획, 실행, 회고를 하나로 잇는 개인 다이어리",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink-700 antialiased">
        <SiteHeader userEmail={session?.user.email} />
        {/* Content container: 20px side gutters on mobile, 40px up to 1200px, then
            48px while growing toward a 1440px cap -- never pinned to a narrow fixed
            width the way max-w-6xl (1152px) read on a 1700px desktop. */}
        <main className="mx-auto max-w-[1440px] px-5 py-10 sm:px-10 min-[1200px]:px-12">{children}</main>
      </body>
    </html>
  );
}
