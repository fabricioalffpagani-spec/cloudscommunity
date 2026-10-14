"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSessionUser } from "./session-user";
import { clearRememberedInstallPrompt, getRememberedInstallPrompt, rememberInstallPrompt, type InstallPromptEvent } from "../lib/pwa-install";

const reminderKey = (userId: string) => `clouds:pwa-install-reminder:${userId}`;
const FIRST_REMINDER_DELAY_MS = 6 * 60_000;
const REMINDER_INTERVAL_MS = 24 * 60 * 60_000;

function readReminder(userId: string) {
  try {
    return Number(window.localStorage?.getItem?.(reminderKey(userId)) || 0);
  } catch {
    return 0;
  }
}

function saveReminder(userId: string, timestamp: number) {
  try {
    window.localStorage?.setItem?.(reminderKey(userId), String(timestamp));
  } catch {
    // Private browsing or embedded contexts can deny storage access.
  }
}

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
      const prompt = event as InstallPromptEvent;
      rememberInstallPrompt(prompt);
      setInstallPrompt(prompt);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      clearRememberedInstallPrompt();
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      // O PWA não pode manter uma interface antiga depois de uma atualização.
      // A busca sem cache garante que o service worker recém-publicado seja
      // verificado em toda abertura do aplicativo instalado.
      void navigator.serviceWorker
        .register("/clouds-sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user || open || isInstalled()) return;
    const createdAt = new Date(user.createdAt).getTime();
    if (Number.isNaN(createdAt)) return;
    const lastReminder = readReminder(user.id);
    const dueAt = lastReminder > 0 ? lastReminder + REMINDER_INTERVAL_MS : createdAt + FIRST_REMINDER_DELAY_MS;
    const showWhenDue = () => {
      if (isInstalled() || Date.now() < dueAt) return;
      saveReminder(user.id, Date.now());
      setInstallPrompt((current) => current ?? getRememberedInstallPrompt());
      setOpen(true);
    };
    showWhenDue();
    const timer = window.setTimeout(showWhenDue, Math.max(0, dueAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [open, status, user]);

  const decline = () => {
    setOpen(false);
  };

  const install = async () => {
    if (!installPrompt) {
      window.location.assign("/settings");
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
      clearRememberedInstallPrompt();
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171325] p-6 shadow-2xl">
        <Image src="/logo_clouds.png" alt="Clouds" width={48} height={48} className="h-12 w-12 object-contain" priority />
        <h2 id="pwa-install-title" className="mt-4 text-[20px] font-bold text-white">Adicione um atalho para o Clouds na tela inicial para economizar tempo!</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">Abra o Clouds mais rápido, como um aplicativo.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={decline} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/65 transition hover:text-white">Não</button>
          <button type="button" onClick={() => void install()} className="rounded-full bg-[#9333EA] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]">Adicionar atalho</button>
        </div>
      </section>
    </div>
  );
}
