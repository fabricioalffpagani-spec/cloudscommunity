"use client";

import { useEffect, useRef } from "react";
import { useSessionUser } from "./session-user";
import { subscribeToPushNotifications } from "../lib/push-subscription";

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
      const subscribe = () => { void subscribeToPushNotifications().catch((error) => console.warn("Push indisponível:", error)); };
      subscribe();
      window.addEventListener("focus", subscribe);
      return () => window.removeEventListener("focus", subscribe);
    }

    if (Notification.permission !== "default") return;

    const prompt = () => {
      if (promptStarted.current) return;
      promptStarted.current = true;
      void requestNativePermission().catch((error) => console.warn("Push indisponível:", error));
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
