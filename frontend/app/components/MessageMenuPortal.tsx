"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  alignRight?: boolean;
};

export function MessageMenuPortal({
  anchorRef,
  menuRef,
  children,
  alignRight = false,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const menu = wrapperRef.current;
      if (!anchor || !menu) return;
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const gap = 4;
      const top =
        rect.bottom + height + gap <= window.innerHeight
          ? rect.bottom + gap
          : Math.max(8, rect.top - height - gap);
      const left = Math.max(
        8,
        Math.min(
          alignRight ? rect.right - width : rect.left,
          window.innerWidth - width - 8,
        ),
      );
      setPosition({ top, left, ready: true });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, alignRight]);

  return createPortal(
    <div
      ref={(node) => {
        wrapperRef.current = node;
        menuRef.current = node;
      }}
      data-message-menu-portal="true"
      className="fixed z-[9999]"
      style={{
        top: position.top,
        left: position.left,
        visibility: position.ready ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
