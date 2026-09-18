import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="label-coord text-[10px] text-ink-400">404 / NOT FOUND</p>
      <h1 className="text-lg font-bold text-ink-900">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-ink-500">요청하신 계획 또는 할 일이 존재하지 않거나 삭제되었습니다.</p>
      <Link href="/" className="mt-2 inline-flex rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
