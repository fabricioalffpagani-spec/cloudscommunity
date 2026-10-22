import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeetPage from "../app/meet/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: null, refresh: vi.fn() }), SessionUserAvatar: () => null }));
vi.mock("../app/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));
vi.mock("../app/components/MessagesNavLink", () => ({ MessagesNavLink: () => null }));
vi.mock("../app/components/MobileAppChrome", () => ({ MobileAppNav: () => null, MobileFeedHeader: () => null, useMobileFeedTabSwipe: () => ({}) }));

describe("Meet featured profiles", () => {
  it.each([375, 1280])("shows four mutual followers and opens the complete list at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const mutualFollowers = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, username: `pessoa${i}`, displayName: `Pessoa ${i}`, avatarUrl: `/avatar${i}.png`, profileUrl: `/users/pessoa${i}` }));
    const target = { id: "target", username: "vicente", displayName: "Vicente", profileUrl: "/users/vicente", avatarUrl: null, isFollowing: false, isSelf: false, mutualFollowersCount: 10, mutualFollowers: mutualFollowers.slice(0, 4) };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("mutual-followers") ? { followers: mutualFollowers } : { ok: true, popularRecent: [], popularAllTime: [], nearby: [target], newUsers: [] } })));
    render(<MeetPage />);
    fireEvent.click(screen.getByRole("button", { name: "Próximos a você" }));
    const button = await screen.findByRole("button", { name: "Ver seguidores em comum com Vicente" });
    expect(within(button).getByText("Seguido(a) por")).toBeInTheDocument();
    expect(within(button).getByText("e 6 outras pessoas")).toBeInTheDocument();
    expect(button.querySelectorAll("img")).toHaveLength(4);
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Seguidores em comum" });
    expect(await within(dialog).findAllByRole("link")).toHaveLength(10);
    expect(within(dialog).getByRole("link", { name: /Pessoa 9/ })).toHaveAttribute("href", "/users/pessoa9");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
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
