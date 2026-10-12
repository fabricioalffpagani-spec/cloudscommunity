self.addEventListener("message", (event) => {
  if (event.data?.type === "clouds:push-diagnostics-version") {
    event.ports?.[0]?.postMessage({
      version: "2026-10-12-push-diagnostics-v1",
    });
  }
});

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
  let timingWrite = Promise.resolve();
  const timingRecord = timing?.traceId
    ? {
        trace: timing.traceId,
        subscription: timing.subscription,
        sentAt: timing.sentAt,
        pushReceivedAt: new Date().toISOString(),
      }
    : null;
  const recordTiming = (fields) => {
    if (!timingRecord) return Promise.resolve();
    Object.assign(timingRecord, fields);
    const snapshot = JSON.stringify(timingRecord);
    timingWrite = timingWrite
      .then(async () => {
        const cache = await caches.open("clouds-push-timing-v1");
        await cache.put(
          `/__push_timing__/${timingRecord.trace}/${timingRecord.subscription}`,
          new Response(snapshot, {
            headers: { "Content-Type": "application/json" },
          }),
        );
      })
      .catch(() => undefined);
    return timingWrite;
  };
  const receivedWrite = recordTiming({});
  if (timing?.traceId) {
    console.info("push_timing", {
      trace: timing.traceId,
      subscription: timing.subscription,
      sentAt: timing.sentAt,
      pushReceivedAt: new Date().toISOString(),
    });
  }
  const tag = data.tag || "clouds-notification";
  const showNotificationAt = new Date().toISOString();
  const calledWrite = recordTiming({ showNotificationAt });
  if (timing?.traceId) {
    console.info("push_timing", {
      trace: timing.traceId,
      subscription: timing.subscription,
      showNotificationAt,
    });
  }
  let showTask;
  try {
    showTask = self.registration.showNotification(data.title || "Clouds", {
      body: data.body || "Você tem uma nova notificação.",
      // Android uses the transparent badge as a monochrome status-bar glyph.
      // Keep the full-color icon for the expanded notification.
      icon: "/pwa-512x512.png?v=5",
      badge: "/clouds-notification-badge-v2.png",
      tag,
      renotify: Boolean(data.messageId),
      data: { url: data.url || "/", messageId: data.messageId },
    });
  } catch (error) {
    showTask = Promise.reject(error);
  }
  const tasks = [
    Promise.resolve(showTask).then(
      () => recordTiming({ showResolvedAt: new Date().toISOString() }),
      async (error) => {
        await recordTiming({
          showErrorName: error instanceof Error ? error.name : "UnknownError",
        });
        throw error;
      },
    ),
    receivedWrite,
    calledWrite,
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
