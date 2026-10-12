import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Notice = {
  title: string;
  options: {
    tag: string;
    body: string;
    data: { url: string; messageId?: string; count: number };
  };
};

function createWorker(windows: Array<{ visibilityState: string }> = []) {
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
      getNotifications: async ({ tag }: { tag: string }) =>
        notices.has(tag) ? [notices.get(tag)!.options] : [],
    },
    clients: { matchAll: async () => windows },
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
  return { notices, showNotification, push, timing, timingLog };
}

describe("push service worker", () => {
  it("keeps one notification per conversation and ignores redelivery of the same message", async () => {
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
    expect(worker.showNotification).toHaveBeenCalledTimes(3);
    expect(worker.notices.size).toBe(2);
    expect(worker.notices.get("direct-message-a")?.options.body).toContain(
      "2 mensagens",
    );
    expect(worker.notices.get("direct-message-a")?.options.data.url).toBe(
      "/messages?conversation=a",
    );
  });

  it("still displays a cloud push when the only app window is hidden", async () => {
    const worker = createWorker([{ visibilityState: "hidden" }]);
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
  });

  it("displays a cloud push with no app window open", async () => {
    const worker = createWorker([]);
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
