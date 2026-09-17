import type { Metadata } from "next";
import "./globals.css";
import { TopBanner } from "@/components/TopBanner";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "DO:IT — Plan Do See 다이어리",
  description: "계획, 실행, 회고를 하나로 잇는 공개 다이어리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink-700 antialiased">
        <TopBanner />
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="label-coord text-[10px] text-ink-400">
            PLAN → DO → SEE · SEOUL TIME (UTC+9)
          </p>
        </footer>
      </body>
    </html>
  );
}
