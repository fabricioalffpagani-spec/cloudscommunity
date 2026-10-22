import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicProfilePage from "../app/users/[id]/page";

const sessionRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ana" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({
    user: { id: "viewer", username: "viewer" },
    refresh: sessionRefresh,
  }),
}));
vi.mock("../app/components/NotificationsPanel", () => ({
  NotificationsBell: () => null,
}));

const profile = (isFollowing: boolean) => ({
  id: "ana-id",
  username: "ana",
  displayName: "Ana",
  avatarUrl: null,
  followersCount: isFollowing ? 2 : 1,
  followingCount: 0,
  cloudsCount: 0,
  hypesCount: 0,
  showHypesCount: false,
  isFollowing,
  isFollowRequested: false,
  isSelf: false,
  isBlockedByMe: false,
  isBlockedByUser: false,
  isPrivate: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const result = (user: ReturnType<typeof profile>, ok = true) => ({
  ok,
  json: async () => ({ ok, user }),
});

beforeEach(() => sessionRefresh.mockReset());

describe("profile follow counters", () => {
  it.each([375, 1280])("opens the complete Cloud participant list on a visited profile at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const participants = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Pessoa ${i}`, username: `pessoa${i}`, avatarUrl: null }));
    const data = { ...profile(false), activeClouds: [{ id: "live", title: "Cloud ativa", authorId: "ana-id", duration: "30min", createdAt: new Date().toISOString(), scheduledAt: null, participantProfiles: participants, visibility: "public", href: "/cloud/live" }], endedClouds: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(data)));
    render(<PublicProfilePage />);
    await screen.findByText("Cloud ativa");
    fireEvent.click(screen.getByRole("button", { name: "Ver participantes da Cloud" }));
    const dialog = screen.getByRole("dialog", { name: "Participantes" });
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getAllByRole("link")).toHaveLength(6);
    expect(within(dialog).getByRole("link", { name: /Pessoa 5/ })).toHaveAttribute("href", "/users/p5");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Participantes" })).not.toBeInTheDocument();
  });

  it.each([375, 1280])("shows mutual followers below the bio and opens their profiles at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const followers = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, username: `pessoa${i}`, displayName: `Pessoa ${i}`, avatarUrl: `/avatar${i}.png`, profileUrl: `/users/pessoa${i}` }));
    const data = { ...profile(false), bio: "Minha bio" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/mutual-followers") ? { ok: true, json: async () => ({ followers }) } : result(data)));
    render(<PublicProfilePage />);
    const button = await screen.findByRole("button", { name: "Ver seguidores em comum com Ana" });
    expect(button.previousElementSibling).toHaveTextContent("Minha bio");
    expect(within(button).getByText("Seguido(a) por")).toBeInTheDocument();
    expect(within(button).getByText("e 2 outras pessoas")).toBeInTheDocument();
    expect(button.querySelectorAll("img")).toHaveLength(4);
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Seguidores em comum" });
    expect(await within(dialog).findAllByRole("link")).toHaveLength(6);
    expect(within(dialog).getByRole("link", { name: /Pessoa 5/ })).toHaveAttribute("href", "/users/pessoa5");
  });

  it("hides the mutual followers line when there are none", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/mutual-followers") ? { ok: true, json: async () => ({ followers: [] }) } : result(profile(false))));
    render(<PublicProfilePage />);
    await screen.findByRole("button", { name: "Follow" });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/users/ana/mutual-followers", { cache: "no-store" }));
    expect(screen.queryByRole("button", { name: "Ver seguidores em comum com Ana" })).toBeNull();
  });
  it("shows another profile's Cloud details in a portal and dismisses them on outside click", async () => {
    const data = { ...profile(false), activeClouds: [{ id: "live", title: "Cloud ativa", authorId: "ana-id", duration: "30min", createdAt: new Date().toISOString(), scheduledAt: null, participantProfiles: [], visibility: "public", href: "/cloud/live" }], endedClouds: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(data)));
    render(<PublicProfilePage />);
    await screen.findByText("Cloud ativa");
    fireEvent.click(screen.getByRole("button", { name: "Opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Informações da Cloud" }));
    const backdrop = screen.getByTestId("cloud-details-backdrop");
    expect(backdrop.parentElement).toBe(document.body);
    expect(screen.getByRole("dialog", { name: "Informações da Cloud" })).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog", { name: "Informações da Cloud" })).not.toBeInTheDocument();
  });
  it("closes another profile's Cloud menu on an outside click", async () => {
    const data = { ...profile(false), activeClouds: [{ id: "live", title: "Cloud ativa", authorId: "ana-id", duration: "30min", createdAt: new Date().toISOString(), scheduledAt: null, participantProfiles: [], visibility: "public", href: "/cloud/live" }], endedClouds: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(data)));
    await (async () => { render(<PublicProfilePage />); await screen.findByText("Cloud ativa"); })();
    const trigger = screen.getByRole("button", { name: "Opções da Cloud" });
    fireEvent.click(trigger);
    const option = screen.getByRole("button", { name: "Informações da Cloud" });
    fireEvent.click(option.parentElement as HTMLElement);
    expect(option).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Informações da Cloud" })).not.toBeInTheDocument();
  });
  it("shows scheduled Clouds with calendar and reminder on another profile", async () => {
    const scheduledAt = new Date(Date.now() + 86400000).toISOString();
    const data = { ...profile(false), activeClouds: [{ id: "scheduled", title: "Cloud futura", authorId: "ana-id", duration: "30min", createdAt: new Date().toISOString(), scheduledAt, participantProfiles: [], visibility: "public", href: "/cloud/scheduled" }], endedClouds: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/join") ? { ok: true } : result(data)));
    render(<PublicProfilePage />);
    const title = await screen.findByText("Cloud futura");
    const card = title.closest("article") as HTMLElement;
    expect(within(card).getByText("Agendada")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Ver data de estreia" }));
    expect(within(card).getByText(/^Estreia em/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Avisar-me na estreia" }));
    expect(await within(card).findByRole("button", { name: "Lembrete ativado" })).toBeDisabled();
  });
  it("does not expose the invitations tab on another user's profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(profile(false))));
    render(<PublicProfilePage />);
    await screen.findByRole("button", { name: "Follow" });
    expect(screen.getByRole("tab", { name: "Minhas Clouds" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Reclouds" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Meus Convites" })).not.toBeInTheDocument();
  });

  it("switches between the visited user's Clouds and Reclouds", async () => {
    const data = { ...profile(false), activeClouds: [{ id: "live", title: "Cloud da Ana", authorId: "ana-id", duration: "30min", createdAt: new Date().toISOString(), scheduledAt: null, participantProfiles: [], visibility: "public", href: "/cloud/live" }], endedClouds: [], reclouds: [{ id: "shared", title: "Cloud republicada", duration: "30min", href: "/cloud/shared", status: "active", scheduledAt: null, author: { name: "Criadora original", username: "criadora", avatarUrl: null } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(data)));
    render(<PublicProfilePage />);
    expect(await screen.findByText("Cloud da Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reclouds" }));
    expect(screen.getByText("Cloud republicada")).toBeInTheDocument();
    expect(screen.getByText("Criadora original").closest("a")).toHaveAttribute("href", "/users/criadora");
    expect(screen.queryByText("Cloud da Ana")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Minhas Clouds" }));
    expect(screen.getByText("Cloud da Ana")).toBeInTheDocument();
  });

  it("shows the invitations tab on the signed-in user's profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result({ ...profile(false), id: "viewer", isSelf: true })));
    render(<PublicProfilePage />);
    expect(await screen.findByRole("tab", { name: "Meus Convites" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Minhas Clouds" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reclouds" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais opções do perfil" })).not.toBeInTheDocument();
  });
  it("keeps blocking in the profile options and allows unblocking", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => url.endsWith("/block") ? { ok: true, json: async () => ({ ok: true }) } : result(profile(false)));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicProfilePage />);
    const options = await screen.findByRole("button", { name: "Mais opções do perfil" });
    expect(screen.queryByRole("button", { name: "Bloquear usuário" })).not.toBeInTheDocument();
    fireEvent.click(options);
    fireEvent.click(screen.getByRole("button", { name: "Bloquear usuário" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/users/ana/block", { method: "POST" }));
    fireEvent.click(options);
    fireEvent.click(await screen.findByRole("button", { name: "Desbloquear usuário" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/users/ana/block", { method: "DELETE" }));
  });
  it("updates after successful follow and unfollow without waiting for polling", async () => {
    let following = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/mutual-followers")) return { ok: true, json: async () => ({ followers: [] }) };
      if (url.startsWith("/api/follow/")) following = init?.method === "POST";
      return result(profile(following));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicProfilePage />);
    await screen.findByRole("button", { name: "Follow" });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Following" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Follow" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("keeps the previous count when the mutation fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("/api/follow/") ? { ok: false, json: async () => ({ message: "Falhou" }) } : url.endsWith("/mutual-followers") ? { ok: true, json: async () => ({ followers: [] }) } : result(profile(false))));
    render(<PublicProfilePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Follow" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Follow" })).not.toBeDisabled(),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
