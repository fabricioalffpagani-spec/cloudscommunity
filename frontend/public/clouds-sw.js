self.addEventListener("install", (event) => {
  // Ativa a versão nova assim que o PWA for aberto, sem conservar a interface
  // anterior (que ainda exibia o filtro textual "+ Recentes").
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil((async () => {
    if (data.kind === "cloud_message" && data.cloudId) {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const watching = await Promise.all(windows.map((client) => new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(false), 500);
        channel.port1.onmessage = (reply) => {
          clearTimeout(timeout);
          resolve(reply.data?.watching === true);
        };
        client.postMessage({ type: "clouds:mini-cloud-watching", cloudId: data.cloudId }, [channel.port2]);
      })));
      if (watching.some(Boolean)) return;
    }
    await self.registration.showNotification(data.title || "Clouds", {
    body: data.body || "Você tem uma nova notificação.",
    // Android renders the status-bar glyph from `badge` and the rich
    // notification from `icon`. Use the Clouds maskable asset for both: the
    // previous nearly-empty badge was rejected on some Samsung devices, which
    // made Android fall back to a bell and a generic “C”.
    icon: "/pwa-512x512.png?v=5",
    badge: "/pwa-maskable-512x512.png?v=5",
    tag: data.tag || "clouds-notification",
    data: { url: data.url || "/" },
    });
    if (data.badgeCount && self.navigator.setAppBadge) {
      await self.navigator.setAppBadge(data.badgeCount).catch(() => undefined);
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === url);
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
