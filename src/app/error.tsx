"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 border border-ink-900 bg-surface-muted p-10 text-center">
      <p className="label-coord text-[10px] text-ink-500">ERROR</p>
      <h1 className="text-lg font-bold text-ink-900">문제가 발생했습니다</h1>
      <p className="text-sm text-ink-500">서버 연결에 문제가 있었을 수 있습니다. 잠시 후 다시 시도해주세요.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 inline-flex rounded-sm bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        다시 시도
      </button>
    </div>
  );
}
