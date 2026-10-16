"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSessionUser } from "./session-user";
import { clearRememberedInstallPrompt, getRememberedInstallPrompt, rememberInstallPrompt, type InstallPromptEvent } from "../lib/pwa-install";

const reminderKey = (userId: string) => `clouds:pwa-install-reminder:${userId}`;
const manualInstallCompleteKey = (userId: string) => `clouds:pwa-install-manual-complete:${userId}`;
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

function hasConfirmedManualInstall(userId: string) {
  try {
    return window.localStorage?.getItem?.(manualInstallCompleteKey(userId)) === "true";
  } catch {
    return false;
  }
}

function confirmManualInstall(userId: string) {
  try {
    window.localStorage?.setItem?.(manualInstallCompleteKey(userId), "true");
  } catch {
    // Private browsing or embedded contexts can deny storage access.
  }
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function PwaInstallPrompt() {
  const { user, status } = useSessionUser();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosInstallHelpOpen, setIosInstallHelpOpen] = useState(false);

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
    if (status !== "authenticated" || !user || open || isInstalled() || hasConfirmedManualInstall(user.id)) return;
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
      if (isIos()) {
        setIosInstallHelpOpen(true);
        return;
      }
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

  if (iosInstallHelpOpen) {
    return (
      <div className="fixed inset-0 z-[250] flex items-end bg-black/65 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
        <section className="w-full rounded-t-3xl border border-white/10 bg-[#171325] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-3xl">
          <h2 id="ios-install-title" className="text-[20px] font-bold text-white">Adicione o Clouds à Tela de Início</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">No Safari do iPhone ou iPad:</p>
          <ol className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/85">
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9333EA] text-[12px] font-bold">1</span>Toque em <strong>Compartilhar</strong> na barra inferior.</li>
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9333EA] text-[12px] font-bold">2</span>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li>
          </ol>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIosInstallHelpOpen(false)} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/65 transition hover:text-white">Voltar</button>
            <button type="button" onClick={() => { if (user) confirmManualInstall(user.id); setIosInstallHelpOpen(false); setOpen(false); }} className="rounded-full bg-[#9333EA] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]">Já adicionei o atalho</button>
          </div>
        </section>
      </div>
    );
  }

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
