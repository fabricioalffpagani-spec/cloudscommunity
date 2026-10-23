import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import MessagesPage from "../app/messages/page";

const { params, router } = vi.hoisted(() => ({ params: new URLSearchParams("conversation=conversation-1"), router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => {
  return { useRouter: () => router, useSearchParams: () => params };
});

describe("respostas a comentários no Read", () => {
  it("identifica o comentário como seu apenas para quem recebe a resposta", async () => {
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    const reply = (id: string, senderId: string, comment: string) => ({
      ...oldPin, id, senderId, isPinned: false,
      sender: { ...oldPin.sender, id: senderId },
      content: JSON.stringify({ type: "cloud_comment_reply", cloudTitle: `Cloud ${id}`, comment, response: `Resposta ${id}` }),
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/direct-messages/conversations/conversation-1/messages?")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, messages: [reply("recebida", "peer", "Meu comentário"), reply("enviada", "viewer", "Comentário de outra pessoa")], pinnedMessages: [] }) };
      }
      return originalFetch(input, init);
    }));
    render(<MessagesPage />);
    const received = (await screen.findByText("Cloud recebida")).parentElement!.parentElement!;
    const sent = screen.getByText("Cloud enviada").parentElement!.parentElement!;
    expect(within(received).getByText("Você:")).toBeVisible();
    expect(within(received).getByText("Meu comentário")).toBeVisible();
    expect(within(received).getByText("Resposta")).toBeVisible();
    expect(within(sent).queryByText("Você:")).not.toBeInTheDocument();
    expect(within(sent).getByText("Comentário de outra pessoa")).toBeVisible();
  });
});

vi.mock("../app/components/session-user", () => {
  const user = { id: "viewer", username: "viewer", displayName: "Viewer", avatarUrl: null };
  return {
    useSessionUser: () => ({ user, status: "authenticated", refresh: vi.fn() }),
    getSessionUserDisplayName: () => "Viewer",
    SessionUserAvatar: () => <span />,
    UserAvatar: () => <span />,
  };
});

vi.mock("socket.io-client", () => ({
  io: () => ({ connected: false, on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }),
}));

const oldPin = {
  id: "old-pin",
  conversationId: "conversation-1",
  senderId: "peer",
  type: "text",
  content: "Mensagem antiga fixada",
  clientMessageId: null,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  editedAt: null,
  readAt: null,
  isPinned: true,
  mediaAsset: null,
  sender: { id: "peer", username: "peer", displayName: "Peer", avatarUrl: null },
  reactions: [],
};

beforeEach(() => {
  for (const key of Array.from(params.keys())) params.delete(key);
  params.set("conversation", "conversation-1");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Element.prototype.scrollTo = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown = { ok: true };
    if (url === "/api/direct-messages/conversations") {
      body = { ok: true, conversations: [{
        id: "conversation-1", participantOneId: "viewer", participantTwoId: "peer",
        lastMessageAt: null, lastMessagePreview: null, unreadCount: 0,
        participant: { id: "peer", username: "peer", displayName: "Peer", avatarUrl: null, status: "offline" },
      }] };
    } else if (url.startsWith("/api/direct-messages/conversations/conversation-1/messages?")) {
      body = { ok: true, messages: [], pinnedMessages: [oldPin] };
    } else if (url === "/api/users/following") {
      body = { ok: true, users: [] };
    }
    return { ok: true, status: 200, json: async () => body };
  }));
});

describe("direct message pins", () => {
  it("envia a Cloud automaticamente sem mostrar o card azul e permite tentar novamente em caso de falha", async () => {
    params.set("id", "peer"); params.set("share", "cloud"); params.set("url", "https://clouds.test/cloud/c1"); params.set("title", "Alive"); params.set("autosend", "true");
    const conversation = { id: "conversation-1", participantOneId: "viewer", participantTwoId: "peer", lastMessageAt: null, lastMessagePreview: null, unreadCount: 0, participant: { id: "peer", username: "peer", displayName: "Peer", avatarUrl: null, status: "offline" } };
    let rejectSend: (reason: Error) => void = () => {};
    let attempts = 0;
    const pending = new Promise<never>((_, reject) => { rejectSend = reject; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/link")) {
        if (++attempts === 1) return pending;
        const body = JSON.parse(String(init?.body)) as { url: string; label: string; clientMessageId: string };
        return { ok: true, json: async () => ({ ok: true, message: { ...oldPin, id: "sent", senderId: "viewer", isPinned: false, type: "link", content: JSON.stringify({ url: body.url, label: body.label }), clientMessageId: body.clientMessageId, sender: { id: "viewer", username: "viewer", displayName: "Viewer", avatarUrl: null } } }) };
      }
      if (url === "/api/direct-messages/conversations") return { ok: true, json: async () => init?.method === "POST" ? { ok: true, conversation } : { ok: true, conversations: [conversation] } };
      if (url.includes("/messages?")) return { ok: true, json: async () => ({ ok: true, messages: [], pinnedMessages: [] }) };
      return { ok: true, json: async () => ({ users: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MessagesPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/direct-messages/conversations/conversation-1/link", expect.objectContaining({ method: "POST" })));
    expect(screen.queryByText("Link pronto para enviar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar Cloud" })).not.toBeInTheDocument();
    rejectSend(new Error("Falha no envio"));
    expect(await screen.findByRole("button", { name: "Enviar Cloud" })).toBeVisible();
    expect(screen.queryByText("Link pronto para enviar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar Cloud" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar Cloud" })).not.toBeInTheDocument());
    expect(attempts).toBe(2);
  });
  it("exibe Editada mesmo quando a mensagem está agrupada com outra", async () => {
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    const edited = { ...oldPin, id: "edited", content: "Mensagem editada", isPinned: false, editedAt: "2026-01-01T12:01:00.000Z" };
    const next = { ...oldPin, id: "next", content: "Outra mensagem", isPinned: false, createdAt: "2026-01-01T12:02:00.000Z" };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).startsWith("/api/direct-messages/conversations/conversation-1/messages?")
      ? { ok: true, status: 200, json: async () => ({ ok: true, messages: [edited, next], pinnedMessages: [] }) }
      : originalFetch(input, init)));
    render(<MessagesPage />);
    expect(await screen.findByText("Mensagem editada")).toBeVisible();
    expect(screen.getByText("Editada")).toBeVisible();
  });
  it("shows an older pinned message returned separately from the current message page", async () => {
    render(<MessagesPage />);
    expect(await screen.findByText("Mensagem antiga fixada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Desafixar mensagem" }));
    expect(screen.queryByText("Mensagem antiga fixada")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/direct-messages/conversations/conversation-1/messages/old-pin/pin",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ pinned: false }) }),
    );
  });
});
