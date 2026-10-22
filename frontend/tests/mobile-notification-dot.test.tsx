import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileAppNav } from "../app/components/MobileAppChrome";
import { NotificationsBell } from "../app/components/NotificationsPanel";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "u" }, refresh: vi.fn() }), SessionUserAvatar: () => <span>Foto</span> }));
vi.mock("../app/components/MessagesNavLink", () => ({ MessagesNavLink: () => null }));

afterEach(() => vi.unstubAllGlobals());

describe("mobile profile notification indicator", () => {
  it("appears for unread notifications and disappears after the bell marks them as read", async () => {
    let unread = 2;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/notifications/read") unread = 0;
      return { ok: true, json: async () => ({ unreadCount: unread, notifications: [] }) };
    }));
    render(<><MobileAppNav force /><NotificationsBell /></>);
    expect(await screen.findByRole("link", { name: "Meu perfil, notificações não visualizadas" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Meu perfil" })).toBeVisible());
  });

  it("does not show the indicator when there are no unread notifications", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0 }) }));
    render(<MobileAppNav force />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Meu perfil" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Meu perfil, notificações não visualizadas" })).toBeNull();
  });
});
