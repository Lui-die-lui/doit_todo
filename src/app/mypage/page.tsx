import { requireSessionOrRedirect, getAccountProvider } from "@/lib/session";
import { formatDateTimeSeoul } from "@/lib/date";
import { ChangePasswordForm } from "@/components/mypage/ChangePasswordForm";
import { DeleteAccountSection } from "@/components/mypage/DeleteAccountSection";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<"credential" | "google", string> = {
  credential: "이메일/비밀번호",
  google: "Google",
};

export default async function MyPage() {
  const session = await requireSessionOrRedirect();
  const provider = await getAccountProvider(session.user.id);
  const isCredentialAccount = provider === "credential";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="label-coord text-xs text-ink-400">ACCOUNT</h1>
        <h2 className="text-xl font-bold text-ink-900">마이페이지</h2>
      </div>

      <section aria-labelledby="account-info-heading" className="flex flex-col gap-3">
        <h3 id="account-info-heading" className="label-coord text-[10px] text-ink-400">
          계정 정보
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border border-line bg-surface p-5 sm:grid-cols-2">
          <div>
            <dt className="label-coord text-[10px] text-ink-400">이메일</dt>
            <dd className="text-sm text-ink-900">{session.user.email}</dd>
          </div>
          <div>
            <dt className="label-coord text-[10px] text-ink-400">가입 방식</dt>
            <dd className="text-sm text-ink-900">{provider ? PROVIDER_LABEL[provider] : "알 수 없음"}</dd>
          </div>
          <div>
            <dt className="label-coord text-[10px] text-ink-400">가입일</dt>
            <dd className="font-mono text-sm text-ink-900">{formatDateTimeSeoul(session.user.createdAt)}</dd>
          </div>
          <div>
            <dt className="label-coord text-[10px] text-ink-400">현재 세션 만료 시각</dt>
            <dd className="font-mono text-sm text-ink-900">{formatDateTimeSeoul(session.session.expiresAt)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="password-heading" className="flex flex-col gap-3">
        <h3 id="password-heading" className="label-coord text-[10px] text-ink-400">
          비밀번호 변경
        </h3>
        {isCredentialAccount ? (
          <div className="border border-line bg-surface p-5 sm:p-7">
            <ChangePasswordForm />
          </div>
        ) : (
          <p className="border border-line-strong bg-surface-muted p-4 text-sm text-ink-700">
            Google 로그인 계정은 Doit에서 별도 비밀번호를 사용하지 않습니다.
          </p>
        )}
      </section>

      <section aria-labelledby="danger-heading" className="flex flex-col gap-3">
        <h3 id="danger-heading" className="sr-only">
          위험 구역
        </h3>
        <DeleteAccountSection isCredentialAccount={isCredentialAccount} />
      </section>
    </div>
  );
}
