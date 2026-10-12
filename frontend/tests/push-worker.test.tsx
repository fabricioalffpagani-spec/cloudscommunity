import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Notice = {
  title: string;
  options: {
    tag: string;
    body: string;
    renotify: boolean;
    data: { url: string; messageId?: string };
  };
};

function createWorker() {
  const timing: { pushReceivedAt?: string; showNotificationAt?: string } = {};
  const timingLog = vi.fn();
  const handlers = new Map<
    string,
    (event: {
      data?: { json: () => unknown };
      waitUntil: (promise: Promise<unknown>) => void;
    }) => void
  >();
  const notices = new Map<string, Notice>();
  const showNotification = vi.fn(
    async (title: string, options: Notice["options"]) => {
      timing.showNotificationAt = new Date().toISOString();
      notices.set(options.tag, { title, options });
    },
  );
  const self = {
    addEventListener: (
      name: string,
      handler: (event: {
        data?: { json: () => unknown };
        waitUntil: (promise: Promise<unknown>) => void;
      }) => void,
    ) => handlers.set(name, handler),
    registration: {
      showNotification,
      getNotifications: vi.fn(async () => {
        throw new Error("notification lookup unavailable");
      }),
    },
    clients: {
      matchAll: vi.fn(async () => {
        throw new Error("window lookup unavailable");
      }),
    },
    navigator: {},
  };
  runInNewContext(readFileSync("public/clouds-sw.js", "utf8"), {
    self,
    clients: self.clients,
    MessageChannel,
    setTimeout,
    clearTimeout,
    console: { info: timingLog },
  });
  async function push(payload: unknown) {
    let done = Promise.resolve();
    timing.pushReceivedAt = new Date().toISOString();
    handlers.get("push")!({
      data: { json: () => payload },
      waitUntil: (promise) => {
        done = promise.then(() => undefined);
      },
    });
    await done;
  }
  return {
    notices,
    showNotification,
    getNotifications: self.registration.getNotifications,
    matchAll: self.clients.matchAll,
    push,
    timing,
    timingLog,
  };
}

describe("push service worker", () => {
  it("shows each direct message without waiting for notification or window lookups", async () => {
    const worker = createWorker();
    await worker.push({
      title: "Ana: Oi",
      body: "Oi",
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m1",
    });
    await worker.push({
      title: "Ana: Tudo bem?",
      body: "Tudo bem?",
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m2",
    });
    await worker.push({
      title: "Ana: Tudo bem?",
      body: "Tudo bem?",
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m2",
    });
    await worker.push({
      title: "Bia: Olá",
      body: "Olá",
      url: "/messages?conversation=b",
      tag: "direct-message-b",
      messageId: "m3",
    });
    expect(worker.showNotification).toHaveBeenCalledTimes(4);
    expect(worker.notices.size).toBe(2);
    expect(worker.notices.get("direct-message-a")?.options.body).toBe(
      "Tudo bem?",
    );
    expect(worker.notices.get("direct-message-a")?.options.renotify).toBe(true);
    expect(worker.notices.get("direct-message-a")?.options.data.url).toBe(
      "/messages?conversation=a",
    );
    expect(worker.getNotifications).not.toHaveBeenCalled();
    expect(worker.matchAll).not.toHaveBeenCalled();
  });

  it("displays a cloud push even if window lookup would fail", async () => {
    const worker = createWorker();
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    expect(worker.matchAll).not.toHaveBeenCalled();
  });

  it("displays a cloud push with no app window open", async () => {
    const worker = createWorker();
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    expect(worker.timing.pushReceivedAt).toBeDefined();
    expect(worker.timing.showNotificationAt).toBeDefined();
    expect(
      Date.parse(worker.timing.showNotificationAt!) -
        Date.parse(worker.timing.pushReceivedAt!),
    ).toBeLessThan(1000);
  });

  it("records service worker receive and display times for a diagnostic push", async () => {
    const worker = createWorker();
    await worker.push({
      title: "Cloud",
      pushTiming: {
        traceId: "test-trace",
        subscription: 0,
        sentAt: "2026-10-12T13:00:00.000Z",
      },
    });
    expect(worker.timingLog).toHaveBeenCalledTimes(2);
    expect(worker.timingLog.mock.calls[0][1]).toMatchObject({
      trace: "test-trace",
    });
    expect(worker.timingLog.mock.calls[1][1]).toMatchObject({
      trace: "test-trace",
    });
  });
});
