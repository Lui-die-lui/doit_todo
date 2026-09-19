"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="label-coord flex min-h-[32px] items-center px-3 text-[11px] text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-50"
    >
      LOGOUT
    </button>
  );
}
