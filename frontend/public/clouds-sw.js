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
  event.waitUntil(
    (async () => {
      if (data.kind === "cloud_message" && data.cloudId) {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const watching = await Promise.all(
          windows
            .filter((client) => client.visibilityState === "visible")
            .map(
              (client) =>
                new Promise((resolve) => {
                  const channel = new MessageChannel();
                  const timeout = setTimeout(() => resolve(false), 500);
                  channel.port1.onmessage = (reply) => {
                    clearTimeout(timeout);
                    resolve(reply.data?.watching === true);
                  };
                  client.postMessage(
                    {
                      type: "clouds:mini-cloud-watching",
                      cloudId: data.cloudId,
                    },
                    [channel.port2],
                  );
                }),
            ),
        );
        if (watching.some(Boolean)) return;
      }
      const tag = data.tag || "clouds-notification";
      const previous = data.messageId
        ? (await self.registration.getNotifications({ tag }))[0]
        : null;
      if (data.messageId && previous?.data?.messageId === data.messageId)
        return;
      const count = data.messageId ? (previous?.data?.count || 0) + 1 : 0;
      await self.registration.showNotification(data.title || "Clouds", {
        body:
          count > 1
            ? `${count} mensagens nesta conversa · ${data.body || "Nova mensagem"}`
            : data.body || "Você tem uma nova notificação.",
        // Android uses the transparent badge as a monochrome status-bar glyph.
        // Keep the full-color icon for the expanded notification.
        icon: "/pwa-512x512.png?v=5",
        badge: "/clouds-notification-badge-v2.png",
        tag,
        renotify: count > 1,
        data: { url: data.url || "/", messageId: data.messageId, count },
      });
      if (data.badgeCount && self.navigator.setAppBadge) {
        await self.navigator
          .setAppBadge(data.badgeCount)
          .catch(() => undefined);
      }
    })(),
  );
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
