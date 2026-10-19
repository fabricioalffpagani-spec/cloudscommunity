import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MessagesPage from "../app/messages/page";

vi.mock("next/navigation", () => {
  const params = new URLSearchParams("conversation=conversation-1");
  return { useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => params };
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
