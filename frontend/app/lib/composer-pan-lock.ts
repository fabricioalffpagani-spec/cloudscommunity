"use client";

import { useCallback, useRef } from "react";

/** Prevent a drag over the composer from panning the page or lifting its footer. */
export function installComposerPanLock(footer: HTMLElement) {
  const preventComposerPan = (event: TouchEvent) => {
    const target = event.target;
    // Emoji and sticker pickers retain their own vertical scrolling.
    if (target instanceof Element && target.closest('[data-emoji-picker], [data-cloud-emoji-picker]')) return;
    if (event.cancelable) event.preventDefault();
  };

  footer.addEventListener("touchmove", preventComposerPan, { passive: false });
  return () => footer.removeEventListener("touchmove", preventComposerPan);
}

export function useComposerPanLock() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((footer: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = footer ? installComposerPanLock(footer) : null;
  }, []);
}
