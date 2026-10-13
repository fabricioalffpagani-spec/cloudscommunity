import { describe, expect, it } from "vitest";
import {
  markDirectMessageFailed,
  mergeDirectMessage,
  retryDirectMessage,
} from "../app/lib/merge-direct-message";

type Message = {
  id: string;
  clientMessageId: string | null;
  content: string;
  pending?: boolean;
  failed?: boolean;
  peaks?: number[] | null;
  source?: "socket" | "HTTP";
};

const optimistic = (clientMessageId: string, content: string): Message => ({
  id: clientMessageId,
  clientMessageId,
  content,
  pending: true,
});

const confirmed = (
  id: string,
  clientMessageId: string,
  content: string,
): Message => ({
  id,
  clientMessageId,
  content,
  pending: false,
});

describe("direct message reconciliation", () => {
  it.each(["socket first", "HTTP first"])(
    "keeps one visible message when %s confirms before the other",
    (first) => {
      const pending = optimistic("client-1", "Oi");
      const persisted = confirmed("message-1", "client-1", "Oi");
      const fromSocket = { ...persisted, source: "socket" as const };
      const fromHttp = { ...persisted, source: "HTTP" as const };
      const firstArrival = first === "socket first" ? fromSocket : fromHttp;
      const secondArrival = first === "socket first" ? fromHttp : fromSocket;
      let messages = mergeDirectMessage([], pending);
      messages = mergeDirectMessage(messages, firstArrival);
      messages = mergeDirectMessage(messages, secondArrival);
      expect(messages).toEqual([expect.objectContaining(secondArrival)]);
    },
  );

  it("retains an optimistic message through a stale reload, then reconciles it", () => {
    const pending = optimistic("client-1", "Oi");
    const older = confirmed("message-0", "client-0", "Anterior");
    const persisted = confirmed("message-1", "client-1", "Oi");
    const current = mergeDirectMessage([older], pending);
    const afterReload = current.reduce(
      (list, message) => mergeDirectMessage(list, message),
      [older],
    );
    expect(afterReload.map((message) => message.content)).toEqual([
      "Anterior",
      "Oi",
    ]);
    expect(mergeDirectMessage(afterReload, persisted)).toEqual([
      expect.objectContaining(older),
      expect.objectContaining(persisted),
    ]);
  });

  it("keeps rapid distinct messages and does not deduplicate by content", () => {
    let messages: Message[] = [];
    for (const [id, content] of [
      ["1", "Oi"],
      ["2", "Oi"],
      ["3", "Tudo bem?"],
    ]) {
      messages = mergeDirectMessage(
        messages,
        optimistic(`client-${id}`, content),
      );
    }
    messages = mergeDirectMessage(
      messages,
      confirmed("message-2", "client-2", "Oi"),
    );
    messages = mergeDirectMessage(
      messages,
      confirmed("message-1", "client-1", "Oi"),
    );
    messages = mergeDirectMessage(
      messages,
      confirmed("message-3", "client-3", "Tudo bem?"),
    );
    expect(messages.map((message) => message.id)).toEqual([
      "message-1",
      "message-2",
      "message-3",
    ]);
    expect(messages.every((message) => !message.pending)).toBe(true);
  });

  it("preserves the audio waveform while the persisted message replaces the upload", () => {
    const pending = { ...optimistic("client-audio", ""), peaks: [0.2, 0.8] };
    const persisted = confirmed("message-audio", "client-audio", "");
    expect(mergeDirectMessage([pending], persisted)[0]).toEqual(
      expect.objectContaining({
        id: "message-audio",
        pending: false,
        peaks: [0.2, 0.8],
      }),
    );
  });

  it("keeps a message visible after a lost HTTP response and retries with the same client ID", () => {
    const pending = optimistic("client-1", "Oi");
    const failed = markDirectMessageFailed([pending], "client-1");
    expect(failed).toEqual([
      expect.objectContaining({ id: "client-1", pending: true, failed: true }),
    ]);
    const retried = retryDirectMessage(failed, "client-1");
    expect(retried).toEqual([
      expect.objectContaining({ id: "client-1", pending: true, failed: false }),
    ]);
    expect(
      mergeDirectMessage(retried, confirmed("message-1", "client-1", "Oi")),
    ).toEqual([expect.objectContaining({ id: "message-1", pending: false })]);
  });

  it("does not mark an already confirmed socket message as failed when HTTP later errors", () => {
    const confirmedBySocket = mergeDirectMessage(
      [optimistic("client-1", "Oi")],
      confirmed("message-1", "client-1", "Oi"),
    );
    expect(markDirectMessageFailed(confirmedBySocket, "client-1")).toEqual(
      confirmedBySocket,
    );
  });
});
