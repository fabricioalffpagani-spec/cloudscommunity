"use client";

import { useRef, useState, type ReactNode } from "react";

export function LongPressHint({ children, hint }: { children: ReactNode; hint: string }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByPress = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <span
      className="relative inline-flex"
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        openedByPress.current = false;
        clear();
        timer.current = setTimeout(() => {
          openedByPress.current = true;
          setVisible(true);
        }, 550);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onClickCapture={(event) => {
        if (!openedByPress.current) return;
        event.preventDefault();
        event.stopPropagation();
        openedByPress.current = false;
        window.setTimeout(() => setVisible(false), 2600);
      }}
    >
      {children}
      {visible && <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-[70] mt-3 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a0e3d] px-3 py-2 text-center text-[12px] font-normal leading-snug text-white shadow-xl">{hint}</span>}
    </span>
  );
}
