"use client";

import { useEffect, useState } from "react";

/** A brief, self-dismissing notice fixed near the bottom of the screen. Shows
 * `message` for `durationMs`, then unmounts itself -- no dismiss button, no
 * persistence across reloads. */
export function Toast({ message, durationMs = 3000 }: { message: string; durationMs?: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div role="status" className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <p className="border border-ink-900 bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(17,17,15,0.18)]">
        {message}
      </p>
    </div>
  );
}
