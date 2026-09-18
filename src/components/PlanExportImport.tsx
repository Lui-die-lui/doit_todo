"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/db/schema";
import { formatDateOnly } from "@/lib/date";
import { priorityLabels } from "@/lib/validation";
import { PLAN_IMPORT_STORAGE_KEY, parsePlanExportJson, toPlanExportJson } from "@/lib/plan-export";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugForFilename(title: string): string {
  const slug = title.trim().replace(/\s+/g, "-").slice(0, 60);
  return slug.length > 0 ? `${slug}.json` : "plan.json";
}

export function PlanExportImport({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportPlan = (plan: Plan) => {
    downloadJson(toPlanExportJson(plan), slugForFilename(plan.title));
    setPickerOpen(false);
  };

  const onFileChosen = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    const parsed = parsePlanExportJson(text);
    if (!parsed) {
      setImportError("계획 JSON 파일 형식이 아닙니다. \"내보내기\"로 받은 파일을 선택하세요.");
      return;
    }
    sessionStorage.setItem(PLAN_IMPORT_STORAGE_KEY, JSON.stringify(parsed));
    router.push("/plans/new");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={plans.length === 0}
          title={plans.length === 0 ? "내보낼 계획이 없습니다." : undefined}
          className="inline-flex min-h-[42px] items-center rounded-sm border border-line-strong bg-surface px-5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          계획별 내보내기
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-[42px] items-center rounded-sm border border-line-strong bg-surface px-5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900"
        >
          불러오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFileChosen(file);
          }}
        />
      </div>

      {importError && (
        <p role="alert" className="mt-2 text-xs font-medium text-ink-900">
          {importError}
        </p>
      )}

      {pickerOpen && <PlanPickerModal plans={plans} onPick={exportPlan} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function PlanPickerModal({
  plans,
  onPick,
  onClose,
}: {
  plans: Plan[];
  onPick: (plan: Plan) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="내보낼 계획 선택"
        className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">어떤 계획을 내보낼까요?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-lg leading-none text-ink-400 hover:text-ink-900"
          >
            ×
          </button>
        </div>
        {plans.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-ink-400">내보낼 계획이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-y-auto">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => onPick(plan)}
                  className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="flex items-center gap-2">
                    <span className="break-words text-sm font-medium text-ink-900">{plan.title}</span>
                    {plan.deletedAt && (
                      <span className="label-coord shrink-0 border border-line-strong px-1.5 py-0.5 text-[9px] text-ink-400">
                        ARCHIVED
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-ink-400">
                    {formatDateOnly(plan.startDate)} – {formatDateOnly(plan.endDate)} · {priorityLabels[plan.priority]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-5 py-3">
          <a href="/api/export" className="text-xs text-ink-500 underline underline-offset-2 hover:text-ink-900">
            또는 전체 데이터를 JSON으로 내보내기 →
          </a>
        </div>
      </div>
    </div>
  );
}
