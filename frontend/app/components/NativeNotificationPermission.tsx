"use client";

import { useEffect, useRef } from "react";
import { useSessionUser } from "./session-user";

function vapidKeyToUint8Array(value: string) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

  const keyResponse = await fetch("/api/notifications/push-key", { cache: "no-store" });
  const keyPayload = await keyResponse.json().catch(() => null) as { publicKey?: string | null } | null;
  if (!keyResponse.ok || !keyPayload?.publicKey) return;

  const registration = await navigator.serviceWorker.register("/clouds-sw.js", { updateViaCache: "none" });
  await registration.update();
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToUint8Array(keyPayload.publicKey),
    });

  await fetch("/api/notifications/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
}

async function requestNativePermission() {
  if (!("Notification" in window)) return;
  // Esta chamada precisa acontecer dentro de um clique/tecla real para que
  // Chrome e Samsung Internet exibam a confirmação nativa do Android.
  const permission = await Notification.requestPermission();
  if (permission === "granted") await subscribeToPushNotifications();
}

export function NativeNotificationPermission() {
  const { status } = useSessionUser();
  const promptStarted = useRef(false);

  useEffect(() => {
    if (
      status !== "authenticated"
      || !("Notification" in window)
    ) return;

    // Quem já permitiu pelo Android também precisa estar inscrito no push para
    // que o ícone apareça na barra de status, mesmo sem tocar no sino.
    if (Notification.permission === "granted") {
      void subscribeToPushNotifications();
      return;
    }

    if (Notification.permission !== "default") return;

    const prompt = () => {
      if (promptStarted.current) return;
      promptStarted.current = true;
      void requestNativePermission();
    };

    window.addEventListener("click", prompt, { once: true, capture: true });
    window.addEventListener("keydown", prompt, { once: true, capture: true });
    return () => {
      window.removeEventListener("click", prompt, { capture: true });
      window.removeEventListener("keydown", prompt, { capture: true });
    };
  }, [status]);

  return null;
}
