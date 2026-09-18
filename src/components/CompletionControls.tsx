"use client";

import { useRef, useState, useTransition } from "react";
import { completeTaskAction, uncompleteTaskAction } from "@/lib/actions/completion";

function describeCompletionError(error: "UNAUTHORIZED" | "NOT_FOUND" | "SAVE_FAILED"): string {
  switch (error) {
    case "UNAUTHORIZED":
      return "로그인이 필요합니다.";
    case "NOT_FOUND":
      return "존재하지 않거나 삭제된 할 일입니다.";
    default:
      return "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

export function CompletionControls({
  taskId,
  status,
}: {
  taskId: number;
  status: "TODO" | "DONE";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  function handleComplete() {
    if (isPending) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${taskId}-${Date.now()}-${Math.random()}`;
    }
    const key = idempotencyKeyRef.current;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await completeTaskAction(taskId, key);
      if (!result.ok) {
        setError(describeCompletionError(result.error));
        return;
      }
      idempotencyKeyRef.current = null;
      if (result.alreadyDone) {
        setNotice("이미 완료 처리된 할 일입니다.");
      }
    });
  }

  function handleUncomplete() {
    if (isPending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await uncompleteTaskAction(taskId);
      if (!result.ok) {
        setError(describeCompletionError(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {status === "TODO" ? (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex items-center gap-1 rounded-sm bg-ink-900 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">★</span> {isPending ? "처리 중..." : "완료 처리"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleUncomplete}
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex items-center rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "완료 취소"}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-xs font-medium text-ink-500">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-ink-900">
          {error}
        </p>
      )}
    </div>
  );
}
