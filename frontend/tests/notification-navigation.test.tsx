import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsBell, NotificationsPanel } from "../app/components/NotificationsPanel";
import { NotificationCloudRedirect } from "../app/components/NotificationCloudRedirect";
import LegacyNotificationsPage from "../app/notifications/page";

const { replace, redirect } = vi.hoisted(() => ({ replace: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams("message=msg-1"), redirect }));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ refresh: vi.fn(), status: "authenticated", user: { id: "viewer", isGuest: false } }),
}));

describe("notification navigation", () => {
  afterEach(() => { window.history.replaceState(null, "", "/"); vi.unstubAllGlobals(); });
  it("opens notifications on the profile when arriving from a push", async () => {
    window.history.replaceState(null, "", "/profile?notifications=1&from=push");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notifications: [], unreadCount: 0 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationsBell openFromUrl />);
    expect(await screen.findByText("Nenhuma notificação")).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe("/profile?from=push");
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read", { method: "POST" });
  });

  it("redirects old notification links to the profile", () => {
    LegacyNotificationsPage();
    expect(redirect).toHaveBeenCalledWith("/profile?notifications=1");
  });
  it("links cloud activity, profiles and private messages to their destinations", async () => {
    const actor = { id: "person", username: "ana", displayName: "Ana", avatarUrl: null, profileUrl: "/users/ana" };
    const base = { isRead: false, createdAt: new Date().toISOString(), metadata: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notifications: [
      { ...base, id: "1", type: "cloud_comment", entityType: "cloud_message", entityId: "msg-1", metadata: { cloudId: "cloud-1", messageId: "msg-1" }, title: "Comentário", body: "Novo comentário", actor },
      { ...base, id: "2", type: "follow", entityType: "user", entityId: "person", title: "Perfil", body: "Novo seguidor", actor },
      { ...base, id: "3", type: "direct_message", entityType: "conversation", entityId: "conv-1", title: "Mensagem", body: "Olá", actor },
    ] }) }));
    render(<NotificationsPanel onClose={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Novo comentário" })).toHaveAttribute("href", "/cloud/cloud-1/notification?message=msg-1");
    expect(screen.getByRole("link", { name: "Novo seguidor" })).toHaveAttribute("href", "/users/ana");
    expect(screen.getByRole("link", { name: "Olá" })).toHaveAttribute("href", "/messages?conversation=conv-1");
  });

  it.each([["active", "/cloud/cloud-1?join=1&message=msg-1"], ["ended", "/cloud/cloud-1/conversation?from=read"], ["archived", "/cloud/cloud-1/conversation?from=read"]])("opens a %s cloud at the right destination", async (status, href) => {
    replace.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud: { status } }) }));
    render(<NotificationCloudRedirect cloudId="cloud-1" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(href));
  });
});
