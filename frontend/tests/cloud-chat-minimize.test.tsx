import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CloudChat from "../app/cloud/[id]/CloudChat";
import { MiniCloudDock } from "../app/components/MiniCloudDock";

const { push, back } = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back, replace: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ user: { id: "viewer", username: "viewer", displayName: "Pessoa" }, status: "authenticated" }),
  getSessionUserDisplayName: () => "Pessoa",
  UserAvatar: () => null,
}));
vi.mock("socket.io-client", () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }) }));

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } });
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  push.mockClear(); back.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/messages?")) return { ok: true, json: async () => ({ messages: [], pinnedMessage: null }) };
    if (url.endsWith("/reports")) return { ok: true, json: async () => ({ reports: [] }) };
    if (url === "/api/users/following") return { ok: true, json: async () => ({ users: [] }) };
    return { ok: true, json: async () => ({ cloud: { id: "cloud-1", title: "Conversa", duration: "30min", createdAt: new Date().toISOString(), status: "active", authorId: "viewer", author: { id: "viewer", name: "Pessoa", username: "viewer", avatarUrl: null }, membersCount: 1, members: [], visibility: "public" } }) };
  }));
});

it("opens the MiniCloud when the mobile back arrow returns to the feed", async () => {
  localStorage.setItem("clouds:mini-cloud-popout", "cloud-1");
  render(<><MiniCloudDock /><CloudChat cloudId="cloud-1" /></>);
  fireEvent.click(await screen.findByRole("button", { name: "Minimizar Cloud" }));
  expect(push).toHaveBeenCalledWith("/");
  expect(back).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("clouds:minimized-cloud") ?? "null")).toMatchObject({ id: "cloud-1", title: "Conversa", ownerUserId: "viewer", isAuthor: true, duration: "30min" });
  expect(localStorage.getItem("clouds:mini-cloud-popout")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Expandir Cloud" })).toBeVisible());
});

it("continues to minimize on desktop before returning through browser history", async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(window.history, "length", "get").mockReturnValue(2);
  render(<><MiniCloudDock /><CloudChat cloudId="cloud-1" /></>);
  fireEvent.click(await screen.findByRole("button", { name: "Minimizar Cloud" }));
  expect(back).toHaveBeenCalledOnce();
  expect(JSON.parse(localStorage.getItem("clouds:minimized-cloud") ?? "null")).toMatchObject({ id: "cloud-1", ownerUserId: "viewer" });
  expect(await screen.findByRole("button", { name: "Expandir Cloud" })).toBeVisible();
  vi.restoreAllMocks();
});
