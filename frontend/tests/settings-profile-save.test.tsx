import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import { SessionUserProvider } from "../app/components/session-user";

vi.mock("../app/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

describe("desktop profile settings", () => {
  it("keeps edits through session refresh and saves without overwriting an incomplete legacy location", async () => {
    let user = { id: "owner", username: "owner", name: "Nome", displayName: "Nome", bio: "Bio antiga", location: "Brasil", avatarUrl: null, createdAt: "2025-01-01T00:00:00.000Z" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/auth/me") throw new Error(`Unexpected request ${input}`);
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        user = { ...user, ...body };
        return { ok: true, json: async () => ({ ok: true, user }) };
      }
      return { ok: true, json: async () => ({ ok: true, user: { ...user } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><SettingsPage /></SessionUserProvider>);
    await screen.findByDisplayValue("Nome");
    fireEvent.click(screen.getAllByRole("button", { name: "Perfil" })[0]);
    const bio = screen.getByDisplayValue("Bio antiga");
    fireEvent.change(bio, { target: { value: "Bio atualizada" } });
    fireEvent.focus(window);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => !init?.method).length).toBeGreaterThan(1));
    expect(screen.getByDisplayValue("Bio atualizada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await screen.findByText("Salvo!");
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ bio: "Bio atualizada" });
    expect(JSON.parse(String(patch?.[1]?.body))).not.toHaveProperty("location");
    expect(user.location).toBe("Brasil");
  });
});
