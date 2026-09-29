self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const tasks = [self.registration.showNotification(data.title || "Clouds", {
    body: data.body || "Você tem uma nova notificação.",
    icon: "/logo_ico.png",
    badge: "/logo_ico.png",
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
