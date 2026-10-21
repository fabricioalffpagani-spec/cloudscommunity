"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function CloudDetailsDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} data-testid="cloud-details-backdrop">
      <div role="dialog" aria-modal="true" aria-label="Informações da Cloud" className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-sm overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-[#15161C] p-5 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[#15161C]"><h2 className="text-[18px] font-bold">Informações da Cloud</h2><button type="button" aria-label="Fechar informações" onClick={onClose} className="shrink-0 p-1 text-xl text-white/50">×</button></div>
        {children}
      </div>
    </div>, document.body,
  );
}
