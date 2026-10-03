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
  const tasks = [self.registration.showNotification(data.title || "Clouds", {
    body: data.body || "Você tem uma nova notificação.",
    // `icon` is the full-color app mark in the notification drawer; `badge`
    // is the transparent monochrome mark used by Android's status bar.
    icon: "/clouds-notification-icon.png",
    badge: "/clouds-notification-badge.svg",
    tag: data.tag || "clouds-notification",
    data: { url: data.url || "/" },
  })];
  if (data.badgeCount && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge(data.badgeCount).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === url);
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
