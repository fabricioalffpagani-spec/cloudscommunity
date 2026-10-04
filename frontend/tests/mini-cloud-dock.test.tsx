import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiniCloudDock } from "../app/components/MiniCloudDock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "viewer" } }) }));
vi.mock("socket.io-client", () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }) }));

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  localStorage.clear();
  localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Teste", isAuthor: false, ownerUserId: "viewer" }));
});

describe("Mini Cloud leave", () => {
  it("moves the dock into Document PiP when the browser grants a window", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));
    const pipDocument = document.implementation.createHTMLDocument("Mini Cloud");
    const pipWindow = { document: pipDocument, closed: false, addEventListener: vi.fn(), close: vi.fn() } as unknown as Window;
    const requestWindow = vi.fn(async () => pipWindow);
    Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: { requestWindow } });

    try {
      render(<MiniCloudDock />);
      fireEvent.click(await screen.findByRole("button", { name: "Abrir Mini Cloud fora da aba" }));
      await waitFor(() => expect(requestWindow).toHaveBeenCalledWith({ width: 384, height: 480 }));
      await waitFor(() => expect(pipDocument.body.textContent).toContain("Teste"));
      expect(document.body.querySelector("aside")).not.toBeInTheDocument();
    } finally {
      delete (window as Window & { documentPictureInPicture?: unknown }).documentPictureInPicture;
    }
  });

  it("keeps the normal dock usable when Document PiP is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ messages: [], cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) })));
    Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: { requestWindow: vi.fn().mockRejectedValue(new Error("unsupported")) } });

    try {
      render(<MiniCloudDock />);
      fireEvent.click(await screen.findByRole("button", { name: "Abrir Mini Cloud fora da aba" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir fora da aba");
      expect(screen.getByRole("textbox")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Expandir Cloud" })).toBeEnabled();
    } finally {
      delete (window as Window & { documentPictureInPicture?: unknown }).documentPictureInPicture;
    }
  });

  it("does not restore a Cloud minimized by another account", () => {
    localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Privada", isAuthor: false, ownerUserId: "another-user" }));
    render(<MiniCloudDock />);
    expect(screen.queryByText("Privada")).not.toBeInTheDocument();
  });
  it("uses a compact mobile size without desktop resize or PiP controls", async () => {
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
      expect(screen.getByRole("textbox")).toBeVisible();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    }
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
