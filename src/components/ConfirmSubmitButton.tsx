"use client";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className = "",
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center gap-1 rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-500 transition-colors hover:border-ink-900 hover:text-ink-900 ${className}`}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
