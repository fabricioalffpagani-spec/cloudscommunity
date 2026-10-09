import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiniCloudDock } from "../app/components/MiniCloudDock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "viewer" } }) }));
const { socketHandlers } = vi.hoisted(() => ({ socketHandlers: new Map<string, (payload: unknown) => void>() }));
vi.mock("socket.io-client", () => ({ io: () => ({ on: (event: string, callback: (payload: unknown) => void) => { socketHandlers.set(event, callback); }, emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }) }));

beforeEach(() => {
  if (typeof localStorage.clear !== "function") {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  }
  socketHandlers.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  localStorage.clear();
  localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Teste", isAuthor: false, ownerUserId: "viewer" }));
});

describe("Mini Cloud leave", () => {
  it("keeps navigation, separate-window, and leave controls together", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));
    render(<MiniCloudDock />);
    const expand = await screen.findByRole("button", { name: "Expandir Cloud" });
    expect(screen.getByRole("button", { name: "Sair da Cloud" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Abrir Mini Cloud fora da aba" })).toBeVisible();
    expect(expand.parentElement).toHaveTextContent(/\d+:\d+/);
  });

  it("opens an independent desktop window that remains after the main tab navigates away", async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue({ focus } as unknown as Window);
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));

    render(<MiniCloudDock />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Mini Cloud fora da aba" }));

    expect(open).toHaveBeenCalledWith("/mini-cloud", "clouds-mini-cloud", expect.stringContaining("width=384,height=480"));
    expect(focus).toHaveBeenCalled();
    expect(localStorage.getItem("clouds:mini-cloud-popout")).toBe("cloud-1");
    open.mockRestore();
  });

  it("does not restore a Cloud minimized by another account", () => {
    localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Privada", isAuthor: false, ownerUserId: "another-user" }));
    render(<MiniCloudDock />);
    expect(screen.queryByText("Privada")).not.toBeInTheDocument();
  });

  it("replaces the keyboard with the continuation action when the Cloud expires", async () => {
    localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Encerrada", isAuthor: false, ownerUserId: "viewer", duration: "5min", createdAt: new Date(Date.now() - 301_000).toISOString() }));
    vi.stubGlobal("fetch", vi.fn(async (input: string) => ({ json: async () => input.endsWith("/messages?take=30") ? { messages: [] } : { cloud: { createdAt: new Date(Date.now() - 301_000).toISOString(), duration: "5min", status: "ended" } } })));

    render(<MiniCloudDock />);

    expect(await screen.findByRole("button", { name: "Continuar essa conversa" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "mini-cloud-message" })).not.toBeInTheDocument();
  });
  it("keeps a compact mobile dock draggable without an external-window control", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));

    try {
      render(<MiniCloudDock />);
      const dock = (await screen.findByRole("button", { name: "Expandir Cloud" })).closest("aside");
      expect(dock).toHaveStyle({ width: "280px", height: "268px" });
      expect(screen.queryByRole("separator", { name: "Redimensionar Mini Cloud" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Abrir Mini Cloud fora da aba" })).not.toBeInTheDocument();
      const handle = dock?.firstElementChild as HTMLElement;
      handle.setPointerCapture = vi.fn();
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, clientY: 600 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100, clientY: 400 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(dock).toHaveStyle({ transform: "translate(-102px,-200px)" });
      const messageScroller = dock?.querySelector(".overflow-y-auto") as HTMLElement;
      fireEvent.pointerDown(messageScroller, { pointerId: 2, clientX: 120, clientY: 500 });
      fireEvent.pointerMove(messageScroller, { pointerId: 2, clientX: 120, clientY: 300 });
      expect(dock).toHaveStyle({ transform: "translate(-102px,-200px)" });
      expect(screen.getByRole("textbox")).toBeVisible();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    }
  });

  it("renders Cloud system messages with the shared CloudChat component", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => ({ json: async () => input.endsWith("/messages?take=30") ? { messages: [{ id: "event-1", cloudId: "cloud-1", type: "system", content: "Ana entrou na cloud", createdAt: new Date().toISOString(), sender: { id: "ana", displayName: "Ana", avatarUrl: null } }] } : { cloud: { createdAt: new Date().toISOString(), duration: "30min" } } })));
    render(<MiniCloudDock />);
    expect(await screen.findByText("Ana entrou na cloud")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver perfil de Ana" })).toHaveAttribute("href", "/users/ana");
  });

  it("adds entry and exit system events from the live socket without reloading", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));
    render(<MiniCloudDock />);
    await screen.findByRole("textbox");
    const onMessage = socketHandlers.get("cloud:message:new");
    expect(onMessage).toBeDefined();
    act(() => {
      onMessage?.({ id: "join-1", cloudId: "cloud-1", type: "system", content: "Ana entrou na cloud", createdAt: new Date().toISOString(), sender: { id: "ana", displayName: "Ana", avatarUrl: null } });
      onMessage?.({ id: "leave-1", cloudId: "cloud-1", type: "system", content: "Ana saiu da cloud", createdAt: new Date().toISOString(), sender: { id: "ana", displayName: "Ana", avatarUrl: null } });
    });
    expect(screen.getByText("Ana entrou na cloud")).toBeVisible();
    expect(screen.getByText("Ana saiu da cloud")).toBeVisible();
  });

  it("keeps the Cloud usable after a failed leave and allows retry without reload", async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/leave") && init?.method === "POST") {
        attempts += 1;
        return { ok: attempts > 1 };
      }
      if (input.endsWith("/messages?take=30")) return { json: async () => ({ messages: [] }) };
      return { json: async () => ({ cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MiniCloudDock />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: /^Sair$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
    expect(screen.getByText("Teste")).toBeVisible();
    expect(localStorage.getItem("clouds:minimized-cloud")).toContain("cloud-1");
    expect(screen.getByRole("button", { name: /^Sair$/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair da Cloud" }));
    expect(screen.getByRole("button", { name: /^Sair$/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^Sair$/ }));
    await waitFor(() => expect(screen.queryByText("Teste")).not.toBeInTheDocument());
    expect(localStorage.getItem("clouds:minimized-cloud")).toBeNull();
    expect(attempts).toBe(2);
  });
});
