"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { GoogleContinueButton } from "./GoogleContinueButton";
import { Toast } from "@/components/Toast";

type Tab = "login" | "signup";

// Any OAuth failure (Google account not linkable to an existing email/password
// account, cancelled consent, etc.) lands back here with ?error=<code>. Every code
// gets the same message -- specifics would tell a visitor whether that email is
// already registered under a different login method.
const GOOGLE_ERROR_MESSAGE =
  "Google 로그인을 완료할 수 없습니다. 이메일/비밀번호로 로그인해 주세요.";

// One-time banner notice /mypage redirects back here with after a password
// change (which signs the user out) -- shown inline since it sits right above
// the login form it's telling the user to use. Keyed by ?notice=<code>.
const NOTICE_MESSAGES: Record<string, string> = {
  "password-changed": "비밀번호가 변경되었습니다. 다시 로그인해주세요.",
};
// Account deletion gets a brief toast instead -- there's nothing on this screen
// it needs to sit next to, so it doesn't need to stay up.
const TOAST_MESSAGES: Record<string, string> = {
  "account-deleted": "계정이 삭제되었습니다.",
};

export function AuthScreen() {
  const searchParams = useSearchParams();
  // ?tab=signup lets other screens (e.g. the signed-out /dashboard gate) deep-link
  // straight into the signup tab; anything else -- including no param -- is login.
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "signup" ? "signup" : "login");
  const hasOAuthError = searchParams.has("error");
  const noticeParam = searchParams.get("notice") ?? "";
  const notice = NOTICE_MESSAGES[noticeParam];
  const toastMessage = TOAST_MESSAGES[noticeParam];

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-12">
      <div className="text-center">
        <p className="label-coord text-[10px] text-ink-400">
          DO:IT · PLAN YOUR ORBIT.
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">로그인</h1>
      </div>

      {hasOAuthError && (
        <p
          role="alert"
          className="border border-line-strong bg-surface-muted px-3 py-2 text-center text-xs text-ink-700"
        >
          {GOOGLE_ERROR_MESSAGE}
        </p>
      )}

      {notice && (
        <p role="status" className="border border-line-strong bg-surface-muted px-3 py-2 text-center text-xs text-ink-700">
          {notice}
        </p>
      )}

      {toastMessage && <Toast message={toastMessage} />}

      <div className="flex border border-line">
        <button
          type="button"
          onClick={() => setTab("login")}
          aria-current={tab === "login" ? "page" : undefined}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === "login"
              ? "bg-ink-900 text-white"
              : "bg-surface text-ink-500 hover:text-ink-900"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          aria-current={tab === "signup" ? "page" : undefined}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            tab === "signup"
              ? "bg-ink-900 text-white"
              : "bg-surface text-ink-500 hover:text-ink-900"
          }`}
        >
          회원가입
        </button>
      </div>

      {tab === "login" ? <LoginForm /> : <SignupForm />}

      <div className="flex items-center gap-3 text-[10px] text-ink-400">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        OR
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <GoogleContinueButton />
    </section>
  );
}
