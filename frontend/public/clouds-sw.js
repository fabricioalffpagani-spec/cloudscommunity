self.addEventListener("install", (event) => {
  // Ativa a versão nova assim que o PWA for aberto, sem conservar a interface
  // anterior (que ainda exibia o filtro textual "+ Recentes").
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isViewingNotificationContext(client, data) {
  if (!client.focused || typeof client.url !== "string") return false;

  const currentUrl = new URL(client.url, self.location.origin);
  if (data.kind === "cloud_message" && typeof data.cloudId === "string") {
    return currentUrl.pathname === `/cloud/${encodeURIComponent(data.cloudId)}`;
  }

  const notificationUrl = new URL(data.url || "/", self.location.origin);
  return (
    notificationUrl.pathname === "/messages" &&
    currentUrl.pathname === "/messages" &&
    notificationUrl.searchParams.get("conversation") !== null &&
    notificationUrl.searchParams.get("conversation") === currentUrl.searchParams.get("conversation")
  );
}

async function shouldSuppressNotification(data) {
  const isCloudMessage = data.kind === "cloud_message" && typeof data.cloudId === "string";
  const notificationUrl = new URL(data.url || "/", self.location.origin);
  const isDirectMessage =
    notificationUrl.pathname === "/messages" &&
    notificationUrl.searchParams.get("conversation") !== null;

  if (!isCloudMessage && !isDirectMessage) return false;

  try {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    return windows.some((client) => isViewingNotificationContext(client, data));
  } catch {
    // A falha ao consultar as janelas não pode impedir uma notificação válida.
    return false;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    const payload = event.data ? event.data.json() : {};
    data = payload && typeof payload === "object" ? payload : {};
  } catch {
    /* A malformed payload must still show a notification. */
  }
  const tag = data.tag || "clouds-notification";
  const unreadMessages = Array.isArray(data.unreadMessages)
    ? data.unreadMessages.filter((message) => typeof message === "string")
    : [];
  const showTask = shouldSuppressNotification(data).then((suppressed) => {
    if (suppressed) return undefined;
    return self.registration.showNotification(data.title || "Clouds", {
      body: unreadMessages.length
        ? unreadMessages.join("\n")
        : data.body || "Você tem uma nova notificação.",
      icon: "/clouds_icon.png",
      badge: "/clouds_icon.png",
      tag,
      renotify: Boolean(data.messageId),
      data: { url: data.url || "/", messageId: data.messageId },
    });
  });
  const tasks = [showTask];
  if (data.badgeCount && self.navigator.setAppBadge) {
    tasks.push(
      self.navigator.setAppBadge(data.badgeCount).catch(() => undefined),
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "direct-message-read" ||
      typeof event.data.conversationId !== "string") return;
  const tag = `direct-message-${event.data.conversationId}`;
  event.waitUntil(
    self.registration.getNotifications({ tag }).then((notifications) => {
      notifications.forEach((notification) => notification.close());
    }),
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
