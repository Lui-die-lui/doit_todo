"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField, inputClassName } from "@/components/FormField";

const INVALID_CURRENT_PASSWORD_ERROR = "현재 비밀번호가 올바르지 않습니다.";
const PASSWORD_TOO_SHORT_ERROR = "비밀번호는 8자 이상이어야 합니다.";
const PASSWORD_TOO_LONG_ERROR = "비밀번호가 너무 깁니다.";
const MISMATCH_ERROR = "새 비밀번호가 일치하지 않습니다.";
const GENERIC_ERROR = "비밀번호를 변경할 수 없습니다. 잠시 후 다시 시도해주세요.";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    if (newPassword.length < 8) {
      setNewPasswordError(PASSWORD_TOO_SHORT_ERROR);
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(MISMATCH_ERROR);
      return;
    }

    setPending(true);
    // revokeOtherSessions kills every *other* session immediately. better-auth still
    // issues this device a fresh replacement session token as part of that call, so
    // right after this we sign that one out too -- the requirement is "log the user
    // out everywhere and make them log back in," not "everywhere except here."
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (error) {
      setPending(false);
      if (error.code === "INVALID_PASSWORD") {
        setCurrentPasswordError(INVALID_CURRENT_PASSWORD_ERROR);
      } else if (error.code === "PASSWORD_TOO_SHORT") {
        setNewPasswordError(PASSWORD_TOO_SHORT_ERROR);
      } else if (error.code === "PASSWORD_TOO_LONG") {
        setNewPasswordError(PASSWORD_TOO_LONG_ERROR);
      } else {
        setCurrentPasswordError(GENERIC_ERROR);
      }
      return;
    }

    await authClient.signOut();
    router.push("/login?notice=password-changed");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="현재 비밀번호" htmlFor="current-password" required error={currentPasswordError ?? undefined}>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="새 비밀번호" htmlFor="new-password" required hint="8자 이상" error={newPasswordError ?? undefined}>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField
        label="새 비밀번호 확인"
        htmlFor="new-password-confirm"
        required
        error={confirmPasswordError ?? undefined}
      >
        <input
          id="new-password-confirm"
          name="newPasswordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex justify-center rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85 disabled:opacity-50"
      >
        {pending ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
