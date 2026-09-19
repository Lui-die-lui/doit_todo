"use client";

import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { authClient } from "@/lib/auth-client";

export function GoogleContinueButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    // Full-page redirect to Google; on return, callbackURL/errorCallbackURL take over.
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:border-ink-900 disabled:opacity-50"
    >
      {pending ? (
        "이동 중..."
      ) : (
        <>
          <FaGoogle aria-hidden="true" />
          Google로 계속하기
        </>
      )}
    </button>
  );
}
