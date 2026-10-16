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
      notices.set(options.tag, { title, options });
    },
  );
  const self = {
    location: { origin: "https://clouds.test" },
    addEventListener: (
      name: string,
      handler: (event: {
        data?: { json: () => unknown };
        waitUntil: (promise: Promise<unknown>) => void;
      }) => void,
    ) => handlers.set(name, handler),
    registration: {
      showNotification,
      getNotifications: vi.fn(async ({ tag }: { tag: string }) =>
        notices.has(tag)
          ? [{ close: () => notices.delete(tag) }]
          : [],
      ),
    },
    clients: {
      matchAll: vi.fn(async (): Promise<unknown[]> => {
        throw new Error("window lookup unavailable");
      }),
      openWindow: vi.fn(async () => undefined),
    },
    navigator: {},
  };
  runInNewContext(readFileSync("public/clouds-sw.js", "utf8"), {
    self,
    clients: self.clients,
    MessageChannel,
    URL,
    setTimeout,
    clearTimeout,
  });
  async function push(payload: unknown) {
    let done = Promise.resolve();
    handlers.get("push")!({
      data: { json: () => payload },
      waitUntil: (promise) => {
        done = promise.then(() => undefined);
      },
    });
    await done;
  }
  async function markRead(conversationId: string) {
    let done = Promise.resolve();
    handlers.get("message")!({
      data: { type: "direct-message-read", conversationId },
      waitUntil: (promise: Promise<unknown>) => { done = promise.then(() => undefined); },
    } as never);
    await done;
  }
  async function click(tag: string) {
    const notice = notices.get(tag);
    if (!notice) throw new Error(`Missing notification ${tag}`);
    let done = Promise.resolve();
    handlers.get("notificationclick")!({
      notification: { data: notice.options.data, close: () => notices.delete(tag) },
      waitUntil: (promise: Promise<unknown>) => { done = promise.then(() => undefined); },
    } as never);
    await done;
  }
  return {
    notices,
    showNotification,
    getNotifications: self.registration.getNotifications,
    matchAll: self.clients.matchAll,
    push,
    markRead,
    click,
    openWindow: self.clients.openWindow,
  };
}

describe("push service worker", () => {
  it("suppresses a direct push when its conversation is focused", async () => {
    const worker = createWorker();
    worker.matchAll.mockResolvedValue([
      { url: "https://clouds.test/messages?conversation=a", focused: true },
    ]);

    await worker.push({
      title: "Ana: Oi",
      body: "Oi",
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m1",
    });

    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it("shows a direct push when another conversation is focused", async () => {
    const worker = createWorker();
    worker.matchAll.mockResolvedValue([
      { url: "https://clouds.test/messages?conversation=b", focused: true },
    ]);

    await worker.push({
      title: "Ana: Oi",
      body: "Oi",
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m1",
    });

    expect(worker.showNotification).toHaveBeenCalledTimes(1);
  });

  it("shows each direct message when the conversation is not focused", async () => {
    const worker = createWorker();
    await worker.push({
      title: "Ana: Oi",
      body: "Oi",
      unreadMessages: ["Oi"],
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m1",
    });
    await worker.push({
      title: "Ana: Tudo bem?",
      body: "Tudo bem?",
      unreadMessages: ["Oi", "Tudo bem?"],
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m2",
    });
    await worker.push({
      title: "Ana: Tudo bem?",
      body: "Tudo bem?",
      unreadMessages: ["Oi", "Tudo bem?"],
      url: "/messages?conversation=a",
      tag: "direct-message-a",
      messageId: "m2",
    });
    await worker.push({
      title: "Bia: Olá",
      body: "Olá",
      unreadMessages: ["Olá"],
      url: "/messages?conversation=b",
      tag: "direct-message-b",
      messageId: "m3",
    });
    expect(worker.showNotification).toHaveBeenCalledTimes(4);
    expect(worker.notices.size).toBe(2);
    expect(worker.notices.get("direct-message-a")?.title).toBe("Ana: Tudo bem?");
    expect(worker.notices.get("direct-message-a")?.options.body).toBe("Oi\nTudo bem?");
    expect(worker.notices.get("direct-message-b")?.options.body).toBe("Olá");
    expect(worker.notices.get("direct-message-a")?.options.renotify).toBe(true);
    expect(worker.notices.get("direct-message-a")?.options.data.url).toBe(
      "/messages?conversation=a",
    );
    expect(worker.getNotifications).not.toHaveBeenCalled();
    expect(worker.matchAll).toHaveBeenCalledTimes(4);
  });

  it("shows several unread messages in order, then clears only the read conversation", async () => {
    const worker = createWorker();
    await worker.push({ title: "Ana: Até logo", body: "Até logo", tag: "direct-message-a", messageId: "m3", unreadMessages: ["Oi", "Tudo bem?", "Até logo"] });
    await worker.push({ title: "Bia: Olá", body: "Olá", tag: "direct-message-b", messageId: "m4", unreadMessages: ["Olá"] });
    expect(worker.notices.get("direct-message-a")?.options.body).toBe("Oi\nTudo bem?\nAté logo");
    expect(worker.notices.get("direct-message-a")?.title).toBe("Ana: Até logo");
    await worker.markRead("a");
    expect(worker.notices.has("direct-message-a")).toBe(false);
    expect(worker.notices.has("direct-message-b")).toBe(true);
    await worker.push({ title: "Ana: Nova", body: "Nova", tag: "direct-message-a", messageId: "m5", unreadMessages: ["Nova"] });
    expect(worker.notices.get("direct-message-a")?.options.body).toBe("Nova");
  });

  it("opens the conversation from a notification when the PWA is closed", async () => {
    const worker = createWorker();
    worker.matchAll.mockResolvedValue([]);
    await worker.push({ title: "Ana: Oi", body: "Oi", tag: "direct-message-a", messageId: "m1", url: "/messages?conversation=a", unreadMessages: ["Oi"] });
    await worker.click("direct-message-a");
    expect(worker.openWindow).toHaveBeenCalledWith("https://clouds.test/messages?conversation=a");
    expect(worker.notices.size).toBe(0);
  });

  it("suppresses a cloud push when its CloudChat is focused", async () => {
    const worker = createWorker();
    worker.matchAll.mockResolvedValue([
      { url: "https://clouds.test/cloud/c", focused: true },
    ]);
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it("displays a cloud push when another CloudChat is focused", async () => {
    const worker = createWorker();
    worker.matchAll.mockResolvedValue([
      { url: "https://clouds.test/cloud/other", focused: true },
    ]);
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
  });

  it("displays a cloud push with no app window open", async () => {
    const worker = createWorker();
    await worker.push({ title: "Cloud", kind: "cloud_message", cloudId: "c" });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
  });
});
