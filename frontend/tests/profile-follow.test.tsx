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
    expect(screen.queryByRole("tab", { name: "Meus Convites" })).not.toBeInTheDocument();
  });

  it("shows the invitations tab on the signed-in user's profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result({ ...profile(false), id: "viewer", isSelf: true })));
    render(<PublicProfilePage />);
    expect(await screen.findByRole("tab", { name: "Meus Convites" })).toBeInTheDocument();
  });
  it("updates after successful follow and unfollow without waiting for polling", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(result(profile(false)))
      .mockResolvedValueOnce(result(profile(true)))
      .mockResolvedValueOnce(result(profile(true)))
      .mockResolvedValueOnce(result(profile(false)))
      .mockResolvedValueOnce(result(profile(false)));
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
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(result(profile(false)))
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "Falhou" }),
        }),
    );
    render(<PublicProfilePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Follow" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Follow" })).not.toBeDisabled(),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
