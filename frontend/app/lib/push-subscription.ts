function vapidKeyBytes(value: string) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Uint8Array.from(window.atob(padded), (character) =>
    character.charCodeAt(0),
  );
}

let pendingSubscription: Promise<PushSubscription> | null = null;

export async function subscribeToPushNotifications(): Promise<void> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  pendingSubscription ??= (async () => {
    const keyResponse = await fetch("/api/notifications/push-key", {
      cache: "no-store",
    });
    const keyPayload = (await keyResponse.json().catch(() => null)) as {
      publicKey?: string | null;
    } | null;
    if (!keyResponse.ok || !keyPayload?.publicKey)
      throw new Error("Notificações push não estão configuradas no servidor.");

    const applicationServerKey = vapidKeyBytes(keyPayload.publicKey);
    const registration = await navigator.serviceWorker.register(
      "/clouds-sw.js",
      { updateViaCache: "none" },
    );
    await registration.update();
    let subscription = await registration.pushManager.getSubscription();
    const existingKey = subscription?.options.applicationServerKey;
    const sameKey =
      existingKey &&
      applicationServerKey.length === existingKey.byteLength &&
      applicationServerKey.every(
        (byte, index) => byte === new Uint8Array(existingKey)[index],
      );
    if (subscription && !sameKey) {
      const staleEndpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch("/api/notifications/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: staleEndpoint }),
      });
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    return subscription;
  })().finally(() => {
    pendingSubscription = null;
  });
  const subscription = await pendingSubscription;
  const response = await fetch("/api/notifications/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok)
    throw new Error(
      "Não foi possível registrar este dispositivo para notificações.",
    );
}
