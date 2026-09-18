"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FormField, inputClassName } from "@/components/FormField";

// Password-length codes describe the input itself and get a specific message. Every
// email-side code -- including the duplicate-email one -- falls through to the same
// generic message, so the screen never confirms or denies that a given address is
// already registered (CLAUDE.md 4.2/11장 user-enumeration guidance). Only the format
// check (INVALID_EMAIL) gets its own wording, since malformed input isn't a signal
// about whether the address exists.
const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "비밀번호는 8자 이상이어야 합니다.",
  PASSWORD_TOO_LONG: "비밀번호가 너무 깁니다.",
};
const INVALID_EMAIL_ERROR = "정확한 이메일 형식을 작성해주세요.";
const GENERIC_EMAIL_ERROR = "가입을 완료할 수 없습니다. 입력하신 정보를 다시 확인해주세요.";

const PASSWORD_MISMATCH_ERROR = "비밀번호가 일치하지 않습니다.";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

    if (password !== confirmPassword) {
      setConfirmPasswordError(PASSWORD_MISMATCH_ERROR);
      return;
    }

    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (signUpError) {
      const code = signUpError.code;
      if (code && PASSWORD_ERROR_MESSAGES[code]) {
        setPasswordError(PASSWORD_ERROR_MESSAGES[code]);
      } else if (code === "INVALID_EMAIL") {
        setEmailError(INVALID_EMAIL_ERROR);
      } else {
        setEmailError(GENERIC_EMAIL_ERROR);
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="이름" htmlFor="signup-name" required>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="이메일" htmlFor="signup-email" required error={emailError ?? undefined}>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="비밀번호" htmlFor="signup-password" required hint="8자 이상" error={passwordError ?? undefined}>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField
        label="비밀번호 확인"
        htmlFor="signup-password-confirm"
        required
        error={confirmPasswordError ?? undefined}
      >
        <input
          id="signup-password-confirm"
          name="passwordConfirm"
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
        {pending ? "가입 중..." : "회원가입"}
      </button>
    </form>
  );
}
