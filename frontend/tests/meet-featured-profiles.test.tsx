import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeetPage from "../app/meet/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: null, refresh: vi.fn() }), SessionUserAvatar: () => null }));
vi.mock("../app/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));
vi.mock("../app/components/MessagesNavLink", () => ({ MessagesNavLink: () => null }));
vi.mock("../app/components/MobileAppChrome", () => ({ MobileAppNav: () => null, MobileFeedHeader: () => null, useMobileFeedTabSwipe: () => ({}) }));

describe("Meet featured profiles", () => {
  it.each([375, 1280])("keeps categories and removes period controls at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, popularRecent: [], popularAllTime: [], nearby: [], newUsers: [] }) }));
    render(<MeetPage />);
    expect(await screen.findByRole("heading", { name: "Perfis em destaque:" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "24h" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Geral" })).not.toBeInTheDocument();
    expect(await screen.findByText("Ainda não há hypes suficientes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novos" }));
    expect(screen.getByRole("heading", { name: "Pessoas que acabaram de entrar no Clouds." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quem seguir" }));
    expect(screen.getByRole("heading", { name: "Perfis em destaque:" })).toBeInTheDocument();
  });
});
