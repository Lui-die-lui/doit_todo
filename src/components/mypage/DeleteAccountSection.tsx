"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField, inputClassName } from "@/components/FormField";

const CONFIRM_PHRASE = "탈퇴합니다";

function describeDeleteError(code: string | undefined): string {
  if (code === "INVALID_PASSWORD") return "비밀번호가 올바르지 않습니다.";
  if (code === "SESSION_EXPIRED") return "보안을 위해 다시 로그인한 뒤 탈퇴를 진행해주세요.";
  return "탈퇴를 완료할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

export function DeleteAccountSection({ isCredentialAccount }: { isCredentialAccount: boolean }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = confirmText === CONFIRM_PHRASE && !pending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    // Server reads the account to delete from the verified session cookie alone --
    // there is no userId/email field on this request for it to trust instead.
    const { error: deleteError } = await authClient.deleteUser(
      isCredentialAccount ? { password } : {},
    );

    if (deleteError) {
      setPending(false);
      setError(describeDeleteError(deleteError.code));
      return;
    }

    router.push("/login?notice=account-deleted");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 border border-ink-900 bg-surface p-5 sm:p-7">
      <div>
        <p className="label-coord text-[10px] text-ink-500">DANGER ZONE</p>
        <h2 className="mt-1 text-base font-bold text-ink-900">회원 탈퇴</h2>
      </div>

      <div className="border border-line-strong bg-surface-muted p-4 text-sm text-ink-700">
        <p className="font-medium text-ink-900">삭제되는 자료</p>
        <p className="mt-1">계정, 계획, 할 일, 실행 기록, 회고, 완료 기록이 모두 삭제되며 되돌릴 수 없습니다.</p>
        <p className="mt-2 text-xs text-ink-500">
          Google 계정 자체가 아니라 Doit에 저장된 계정과 자료만 삭제됩니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {isCredentialAccount && (
          <FormField label="현재 비밀번호" htmlFor="delete-password" required>
            <input
              id="delete-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
            />
          </FormField>
        )}
        <FormField
          label={`확인을 위해 "${CONFIRM_PHRASE}"를 입력하세요`}
          htmlFor="delete-confirm"
          required
          error={error ?? undefined}
        >
          <input
            id="delete-confirm"
            name="confirmText"
            type="text"
            autoComplete="off"
            required
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex justify-center rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "탈퇴 처리 중..." : "회원 탈퇴"}
        </button>
      </form>
    </div>
  );
}
