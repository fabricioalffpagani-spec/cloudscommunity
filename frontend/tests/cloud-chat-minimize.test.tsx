import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CloudChat from "../app/cloud/[id]/CloudChat";
import { MiniCloudDock } from "../app/components/MiniCloudDock";

const { push, back } = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back, replace: vi.fn() }) }));
vi.mock("../app/components/session-user", () => {
  const user = { id: "viewer", username: "viewer", displayName: "Pessoa" };
  return {
  useSessionUser: () => ({ user, status: "authenticated" }),
  getSessionUserDisplayName: () => "Pessoa",
  UserAvatar: () => null,
}; });
vi.mock("socket.io-client", () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }) }));

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
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

it.each([true, false])("permite ao host remover comentário no Talk (mobile: %s)", async (mobile) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const original = vi.mocked(fetch).getMockImplementation()!;
  const now = new Date().toISOString();
  const message = { id: "m1", cloudId: "cloud-1", senderId: "other", type: "text", content: "Comentário da Ana", mentions: [], mediaUrl: null, isSticker: false, isPinned: false, clientMessageId: null, replyToMessageId: null, createdAt: now, updatedAt: now, deletedAt: null, sender: { id: "other", username: "ana", displayName: "Ana", avatarUrl: null }, replyTo: null, reactions: [] };
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") return { ok: true, json: async () => ({ ok: true, moderationNotice: "A mensagem de Ana foi removida pelo/a host da Cloud." }) };
    if (String(input).includes("/messages?")) return { ok: true, json: async () => ({ messages: [message], pinnedMessage: null }) };
    return original(input, init);
  }));
  render(<CloudChat cloudId="cloud-1" />);
  fireEvent.contextMenu(await screen.findByText("Comentário da Ana"));
  fireEvent.click(await screen.findByRole("button", { name: "Remover mensagem" }));
  expect(await screen.findByText("A mensagem de Ana foi removida pelo/a host da Cloud.")).toBeVisible();
  expect(screen.queryByText("Comentário da Ana")).not.toBeInTheDocument();
});

it("mostra Editada em uma mensagem de Cloud agrupada e não confunde fixação com edição", async () => {
  const original = vi.mocked(fetch).getMockImplementation()!;
  const now = new Date().toISOString();
  const base = { cloudId: "cloud-1", senderId: "other", type: "text", mentions: [], mediaUrl: null, isSticker: false, isPinned: false, clientMessageId: null, replyToMessageId: null, createdAt: now, updatedAt: now, deletedAt: null, sender: { id: "other", username: "ana", displayName: "Ana", avatarUrl: null }, replyTo: null, reactions: [] };
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).includes("/messages?")
    ? { ok: true, json: async () => ({ messages: [{ ...base, id: "m1", content: "Texto editado", editedAt: now }, { ...base, id: "m2", content: "Texto seguinte", editedAt: null, isPinned: true, updatedAt: new Date(Date.now() + 1000).toISOString() }], pinnedMessage: null }) }
    : original(input, init)));
  render(<CloudChat cloudId="cloud-1" />);
  await screen.findByText("Texto editado");
  expect(screen.getAllByText("Editada")).toHaveLength(1);
  expect(screen.getByText("Editada")).toBeVisible();
});

it("allows the host to close and reopen admission from member management", async () => {
  const originalFetch = vi.mocked(fetch);
  originalFetch.mockImplementation(async (input, init) => {
    if (String(input).endsWith('/admission')) return { ok: true, json: async () => ({ acceptingMembers: JSON.parse(String(init?.body)).acceptingMembers }) } as Response;
    return original(input, init);
  });
  function original(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url.includes('/messages?')) return Promise.resolve({ ok: true, json: async () => ({ messages: [], pinnedMessage: null }) } as Response);
    if (url.endsWith('/reports')) return Promise.resolve({ ok: true, json: async () => ({ reports: [] }) } as Response);
    if (url === '/api/users/following') return Promise.resolve({ ok: true, json: async () => ({ users: [] }) } as Response);
    return Promise.resolve({ ok: true, json: async () => ({ cloud: { id: 'cloud-1', title: 'Conversa', duration: '30min', createdAt: new Date().toISOString(), status: 'active', authorId: 'viewer', author: { id: 'viewer', name: 'Pessoa', username: 'viewer', avatarUrl: null }, membersCount: 1, members: [], visibility: 'public', acceptingMembers: true } }) } as Response);
  }
  render(<CloudChat cloudId="cloud-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar membros' }));
  const toggle = await screen.findByRole('switch', { name: 'Permitir novos participantes' });
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  expect(screen.getByText(/Novas pessoas não podem entrar/)).toBeInTheDocument();
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
});
