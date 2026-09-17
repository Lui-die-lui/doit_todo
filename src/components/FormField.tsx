import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-1 text-sm font-medium text-ink-700">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-ink-400">
            *
          </span>
        ) : (
          <span className="label-coord text-[10px] font-normal text-ink-400">선택</span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-400">{hint}</p>}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-ink-900">
          <span aria-hidden="true">▲</span> {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  "w-full border border-line bg-surface px-3 py-2 text-sm text-ink-900 transition-colors placeholder:text-ink-400 hover:border-line-strong focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900";
