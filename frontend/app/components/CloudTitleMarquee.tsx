"use client";

import { useEffect, useRef, useState, type PointerEventHandler } from "react";

export function CloudTitleMarquee({
  title,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: {
  title: string;
  onPointerDown?: PointerEventHandler<HTMLHeadingElement>;
  onPointerUp?: PointerEventHandler<HTMLHeadingElement>;
  onPointerLeave?: PointerEventHandler<HTMLHeadingElement>;
  onPointerCancel?: PointerEventHandler<HTMLHeadingElement>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;
    const measure = () =>
      setOverflowing(text.scrollWidth > viewport.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(text);
    return () => observer.disconnect();
  }, [title]);

  return (
    <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden">
      <h1
        className={`${overflowing ? "cloud-title-marquee" : "block"} text-[22px] font-bold leading-tight text-white sm:text-[28px]`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
      >
        <span ref={textRef} className="inline-block shrink-0 whitespace-nowrap">
          {title}
        </span>
        {overflowing && (
          <span
            aria-hidden="true"
            className="inline-block shrink-0 whitespace-nowrap"
          >
            {title}
          </span>
        )}
      </h1>
    </div>
  );
}
