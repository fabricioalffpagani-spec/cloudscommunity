import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
