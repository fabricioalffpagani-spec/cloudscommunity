"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSessionUser } from "./session-user";
import { clearRememberedInstallPrompt, getRememberedInstallPrompt, rememberInstallPrompt, recordInstall, hasRecordedInstall, isAppleMobileDevice, isMobileDevice, type InstallPromptEvent } from "../lib/pwa-install";

const reminderKey = (userId: string) => `clouds:pwa-install-reminder:${userId}`;
const manualInstallCompleteKey = (userId: string) => `clouds:pwa-install-manual-complete:${userId}`;
const signupReminderKey = (username: string) => `clouds:pwa-install-signup-reminder:${username.toLowerCase()}`;
const signupStartKey = (username: string) => `clouds:pwa-install-signup-start:${username.toLowerCase()}`;
const signupCompleteKey = (username: string) => `clouds:pwa-install-signup-complete:${username.toLowerCase()}`;
const FIRST_REMINDER_DELAY_MS = 150_000;
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

function readSignupTimestamp(username: string, key: (username: string) => string) {
  try {
    return Number(window.localStorage?.getItem?.(key(username)) || 0);
  } catch {
    return 0;
  }
}

function saveSignupTimestamp(username: string, key: (username: string) => string, timestamp: number) {
  try {
    window.localStorage?.setItem?.(key(username), String(timestamp));
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
  return hasRecordedInstall() || window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() { return isAppleMobileDevice(window.navigator); }

function isMobile() { return isMobileDevice(window.navigator); }

export function PwaInstallPrompt() {
  const { user, status } = useSessionUser();
  const [, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosInstallHelpOpen, setIosInstallHelpOpen] = useState(false);
  const [installError, setInstallError] = useState("");
  const fallbackReminder = useRef<{ userId: string; timestamp: number } | null>(null);
  const fallbackStart = useRef<{ userId: string; timestamp: number } | null>(null);
  const signupUsername = useRef<string | null>(null);
  const [signupCompletion, setSignupCompletion] = useState<{ username: string; timestamp: number } | null>(null);

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
    const onSignupComplete = (event: Event) => {
      if (!isMobile() || isInstalled() || (user && hasConfirmedManualInstall(user.id))) return;
      const username = (event as CustomEvent<{ username?: string }>).detail?.username;
      if (!username) return;
      const timestamp = Date.now();
      signupUsername.current = username;
      saveSignupTimestamp(username, signupStartKey, timestamp);
      setSignupCompletion({ username, timestamp });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("clouds:signup-complete", onSignupComplete);
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
      window.removeEventListener("clouds:signup-complete", onSignupComplete);
    };
  }, [user?.id]);

  useEffect(() => {
    if (open || !isMobile() || isInstalled() || (user && hasConfirmedManualInstall(user.id))) return;
    const signupUsernameForReminder = signupCompletion?.username ?? user?.username ?? null;
    if (!user && !signupUsernameForReminder) return;
    let signupReminder = 0;
    let signupStart = signupCompletion?.timestamp ?? 0;
    try {
      if (user?.username && window.localStorage.getItem(signupCompleteKey(user.username)) === "true") return;
      if (signupUsernameForReminder) {
        signupReminder = readSignupTimestamp(signupUsernameForReminder, signupReminderKey);
        signupStart = Math.max(signupStart, readSignupTimestamp(signupUsernameForReminder, signupStartKey));
      }
    } catch { /* Storage may be unavailable. */ }
    let createdAt = user ? new Date(user.createdAt).getTime() : 0;
    if (!Number.isFinite(createdAt)) {
      if (user) {
        if (fallbackStart.current?.userId !== user.id) fallbackStart.current = { userId: user.id, timestamp: Date.now() };
        createdAt = fallbackStart.current.timestamp;
      } else {
        createdAt = signupStart || Date.now();
      }
    }
    const storedReminder = user ? readReminder(user.id) : 0;
    const lastReminder = Math.max(Number.isFinite(storedReminder) ? storedReminder : 0, Number.isFinite(signupReminder) ? signupReminder : 0, user && fallbackReminder.current?.userId === user.id ? fallbackReminder.current.timestamp : 0);
    const dueAt = lastReminder > 0 ? lastReminder + REMINDER_INTERVAL_MS : Math.max(createdAt, signupStart) + FIRST_REMINDER_DELAY_MS;
    const showWhenDue = () => {
      if (document.visibilityState === "hidden" || !isMobile() || isInstalled() || (user && hasConfirmedManualInstall(user.id)) || Date.now() < dueAt) return;
      const now = Date.now();
      if (user) {
        fallbackReminder.current = { userId: user.id, timestamp: now };
        saveReminder(user.id, now);
      }
      if (signupUsernameForReminder) saveSignupTimestamp(signupUsernameForReminder, signupReminderKey, now);
      setInstallPrompt((current) => current ?? getRememberedInstallPrompt());
      setOpen(true);
    };
    showWhenDue();
    const timer = window.setTimeout(showWhenDue, Math.max(0, dueAt - Date.now()));
    const onVisibilityChange = () => { if (document.visibilityState === "visible") showWhenDue(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [open, signupCompletion, status, user?.id, user?.username, user?.createdAt]);

  const decline = () => {
    setOpen(false);
  };

  const install = async () => {
    const prompt = getRememberedInstallPrompt();
    if (!prompt) {
      if (isIos()) {
        setIosInstallHelpOpen(true);
        return;
      }
      window.location.assign("/settings?section=aplicativo&installHelp=1");
      return;
    }

    setInstallError("");
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setOpen(false);
    } catch {
      setInstallError("Não foi possível abrir a instalação. Use o menu do navegador para adicionar o Clouds à tela inicial.");
    } finally {
      setInstallPrompt(null);
      clearRememberedInstallPrompt();
    }
  };

  if (!open) return null;

  if (iosInstallHelpOpen) {
    return (
      <div className="fixed inset-0 z-[250] flex items-end bg-black/65 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
        <section className="w-full rounded-t-3xl border border-white/10 bg-[#171325] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-3xl">
          <h2 id="ios-install-title" className="text-[20px] font-bold text-white">Adicione o Clouds à Tela de Início</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">No iPhone ou iPad, use o menu do navegador para adicionar o Clouds:</p>
          <ol className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/85">
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9333EA] text-[12px] font-bold">1</span>Toque em <strong>Compartilhar</strong> no navegador.</li>
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9333EA] text-[12px] font-bold">2</span>Escolha <strong>Adicionar à Tela de Início</strong>. Se não aparecer, procure <strong>Editar Ações</strong>.</li>
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9333EA] text-[12px] font-bold">3</span>Ative <strong>Abrir como App Web</strong>, se aparecer, e toque em <strong>Adicionar</strong>.</li>
          </ol>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIosInstallHelpOpen(false)} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/65 transition hover:text-white">Voltar</button>
            <button type="button" onClick={() => { recordInstall(); if (user) confirmManualInstall(user.id); if (signupUsername.current) { try { window.localStorage.setItem(signupCompleteKey(signupUsername.current), "true"); } catch { /* Storage may be unavailable. */ } } setIosInstallHelpOpen(false); setOpen(false); }} className="rounded-full bg-[#9333EA] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]">Já adicionei o atalho</button>
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
        {installError && <p role="alert" className="mt-3 text-[13px] text-red-300">{installError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={decline} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/65 transition hover:text-white">Não</button>
          <button type="button" onClick={() => void install()} className="rounded-full bg-[#9333EA] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]">Instalar agora</button>
        </div>
      </section>
    </div>
  );
}
