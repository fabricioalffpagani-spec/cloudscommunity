self.addEventListener("install", (event) => {
  // Ativa a versão nova assim que o PWA for aberto, sem conservar a interface
  // anterior (que ainda exibia o filtro textual "+ Recentes").
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    const payload = event.data ? event.data.json() : {};
    data = payload && typeof payload === "object" ? payload : {};
  } catch {
    /* A malformed payload must still show a notification. */
  }
  const timing = data.pushTiming;
  if (timing?.traceId) {
    console.info("push_timing", {
      trace: timing.traceId,
      subscription: timing.subscription,
      sentAt: timing.sentAt,
      pushReceivedAt: new Date().toISOString(),
    });
  }
  const tag = data.tag || "clouds-notification";
  if (timing?.traceId) {
    console.info("push_timing", {
      trace: timing.traceId,
      subscription: timing.subscription,
      showNotificationAt: new Date().toISOString(),
    });
  }
  const tasks = [
    self.registration.showNotification(data.title || "Clouds", {
      body: data.body || "Você tem uma nova notificação.",
      // Android uses the transparent badge as a monochrome status-bar glyph.
      // Keep the full-color icon for the expanded notification.
      icon: "/pwa-512x512.png?v=5",
      badge: "/clouds-notification-badge-v2.png",
      tag,
      renotify: Boolean(data.messageId),
      data: { url: data.url || "/", messageId: data.messageId },
    }),
  ];
  if (data.badgeCount && self.navigator.setAppBadge) {
    tasks.push(
      self.navigator.setAppBadge(data.badgeCount).catch(() => undefined),
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin)
    .href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const existing = windows.find((client) => client.url === url);
        return existing ? existing.focus() : clients.openWindow(url);
      }),
  );
});
