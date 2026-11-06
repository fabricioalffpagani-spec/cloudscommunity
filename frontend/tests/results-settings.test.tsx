import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import { SessionUserProvider } from "../app/components/session-user";

vi.mock("../app/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const user = { id: "owner", username: "owner", name: "Nome", displayName: "Nome", email: "owner@example.com", bio: "", avatarUrl: null, createdAt: "2026-01-01T00:00:00.000Z" };

describe("Resultados nas configurações", () => {
  it("disponibiliza a opção em mobile e desktop e apresenta métricas claras", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/me") return { ok: true, json: async () => ({ ok: true, user }) };
      if (String(input) === "/api/users/results") return { ok: true, json: async () => ({ ok: true, results: { profileVisitors: 18, forYouReach: 12, forYouAccessRate: 25, forYouAccesses: 3, followers: 44, newFollowersLast30Days: 5, totalClouds: 6, uniqueCloudVisitors: 30, totalHypes: 9, totalMessages: 71, bestCloud: { title: "Cloud favorita", participants: 12, hypes: 5 } } }) };
      throw new Error(`Unexpected request ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><SettingsPage /></SessionUserProvider>);

    await screen.findByDisplayValue("Nome");
    expect(screen.getAllByRole("button", { name: "Resultados" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Resultados" })[0]);

    expect(await screen.findByText("Visitas ao perfil")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Cloud favorita")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/users/results", { cache: "no-store" });
  });
});
