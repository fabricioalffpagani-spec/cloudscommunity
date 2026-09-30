"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSessionUser } from "./session-user";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const declinedKey = (userId: string) => `clouds:pwa-install-declined:${userId}`;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const { user, status } = useSessionUser();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/clouds-sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user || !installPrompt || isInstalled()) return;
    if (window.localStorage.getItem(declinedKey(user.id)) === "1") return;
    setOpen(true);
  }, [installPrompt, status, user]);

  const decline = () => {
    if (user) window.localStorage.setItem(declinedKey(user.id), "1");
    setOpen(false);
  };

  const install = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171325] p-6 shadow-2xl">
        <Image src="/logo_clouds.png" alt="Clouds" width={48} height={48} className="h-12 w-12 object-contain" priority />
        <h2 id="pwa-install-title" className="mt-4 text-[20px] font-bold text-white">Adicione um atalho para o Clouds em sua tela inicial?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">Abra o Clouds mais rápido, como um aplicativo.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={decline} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/65 transition hover:text-white">Não</button>
          <button type="button" onClick={() => void install()} className="rounded-full bg-[#9333EA] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]">Sim</button>
        </div>
      </section>
    </div>
  );
}
