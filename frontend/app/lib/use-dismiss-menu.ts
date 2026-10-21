"use client";

import { useEffect, useRef } from "react";

export function useDismissMenu(open: boolean, dismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKeyDown); };
  }, [open, dismiss]);
  return ref;
}
