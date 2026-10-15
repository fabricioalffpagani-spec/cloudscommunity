"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  avatarUrl: string | null | undefined;
  name: string;
  children: React.ReactNode;
};

export function ProfileAvatarViewer({ avatarUrl, name, children }: Props) {
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showMissingToast = () => {
    setShowToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 2200);
  };

  const showPhoto = () => {
    if (avatarUrl?.trim() && avatarUrl !== failedUrl) {
      setOpen(true);
      return;
    }
    showMissingToast();
  };

  return (
    <>
      <button
        type="button"
        onClick={showPhoto}
        onErrorCapture={() => avatarUrl && setFailedUrl(avatarUrl)}
        aria-label={`Ampliar foto de perfil de ${name}`}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC]"
      >
        {children}
      </button>
      {showToast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/10 bg-[#211537]/95 px-4 py-2 text-xs text-white/85 shadow-xl pointer-events-none"
        >
          Sem foto de perfil
        </div>
      )}
      {open && avatarUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de perfil de ${name}`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
        >
          <div
            className="relative max-h-[90dvh] max-w-[min(90vw,680px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar foto"
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#211537] text-xl text-white shadow-xl"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={`Foto de perfil de ${name}`}
              onError={() => {
                setFailedUrl(avatarUrl);
                setOpen(false);
                showMissingToast();
              }}
              className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
