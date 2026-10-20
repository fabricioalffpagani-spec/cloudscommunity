import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../app/profile/page";
import SettingsPage from "../app/settings/page";
import { SessionUserProvider, useSessionUser } from "../app/components/session-user";

vi.mock("../app/components/NotificationsPanel", () => ({ NotificationsBell: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/profile", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const original = { id: "owner", username: "owner", name: "Nome antigo", displayName: "Nome antigo", email: "owner@example.com", bio: "Bio", location: "Brasil", avatarUrl: null, createdAt: "2025-01-01T00:00:00.000Z" };
const response = (user: typeof original) => ({ ok: true, json: async () => ({ ok: true, user }) });

function NameObserver() {
  const { user } = useSessionUser();
  return <div data-testid="current-name">{user?.displayName}</div>;
}

afterEach(() => vi.unstubAllGlobals());

describe("profile name updates", () => {
  it("updates the session from account settings and ignores an older refresh", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    let getCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/auth/me") throw new Error(`Unexpected request ${input}`);
      if (init?.method === "PATCH") return Promise.resolve(response({ ...original, name: "Nome novo", displayName: "Nome novo" }));
      getCount++;
      if (getCount > 1) return new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; });
      return Promise.resolve(response(original));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><SettingsPage /><NameObserver /></SessionUserProvider>);
    fireEvent.change(await screen.findByDisplayValue("Nome antigo"), { target: { value: "Nome novo" } });
    fireEvent.focus(window);
    await waitFor(() => expect(getCount).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByTestId("current-name")).toHaveTextContent("Nome novo"));
    await act(async () => { resolveOld(response(original)); });
    expect(screen.getByTestId("current-name")).toHaveTextContent("Nome novo");
  });

  it("preserves the profile draft during refresh and displays the saved name", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/clouds/mine") return { ok: true, json: async () => ({ ok: true, clouds: [] }) };
      if (String(input) === "/api/auth/me") {
        if (init?.method === "PATCH") return response({ ...original, name: "Nome novo", displayName: "Nome novo" });
        return response(original);
      }
      throw new Error(`Unexpected request ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><ProfilePage /></SessionUserProvider>);
    await screen.findByRole("heading", { name: "Nome antigo" });
    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    fireEvent.change(screen.getByDisplayValue("Nome antigo"), { target: { value: "Nome novo" } });
    fireEvent.focus(window);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) => String(url) === "/api/auth/me" && !init?.method)).toHaveLength(2));
    expect(screen.getByDisplayValue("Nome novo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Nome novo" });
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).not.toHaveProperty("location");
  });
});
