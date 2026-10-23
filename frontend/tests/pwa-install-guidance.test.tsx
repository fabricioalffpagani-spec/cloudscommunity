import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelAplicativo } from "../app/components/PanelAplicativo";
import { clearRememberedInstallPrompt, isAppleMobileDevice, isMacSafariBrowser, rememberInstallPrompt, type InstallPromptEvent } from "../app/lib/pwa-install";

vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "u", username: "tester" } }), SessionUserAvatar: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
const originalAgent = navigator.userAgent;
beforeEach(() => { localStorage.clear(); clearRememberedInstallPrompt(); window.matchMedia = vi.fn().mockReturnValue({ matches: false }); });
afterEach(() => { Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalAgent }); window.history.replaceState(null, "", "/"); clearRememberedInstallPrompt(); });

describe("install guidance", () => {
  it("recognizes an iPad using a desktop user agent without treating a Mac as an iPad", () => {
    const ipad = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1", platform: "MacIntel", maxTouchPoints: 5 };
    const mac = { ...ipad, maxTouchPoints: 0 };
    expect(isAppleMobileDevice(ipad)).toBe(true);
    expect(isMacSafariBrowser(ipad)).toBe(false);
    expect(isMacSafariBrowser(mac)).toBe(true);
  });
  it("shows Android manual steps when the native prompt is unavailable", () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Linux; Android 14)" });
    window.history.replaceState(null, "", "/settings?section=aplicativo&installHelp=1");
    render(<PanelAplicativo />);
    expect(screen.getByText(/Abra o menu do navegador/)).toHaveTextContent("Adicionar à tela inicial");
  });
  it("offers a useful fallback when desktop installation fails", async () => {
    const event = Object.assign(new Event("beforeinstallprompt"), { prompt: vi.fn().mockRejectedValue(new Error("failed")), userChoice: Promise.resolve({ outcome: "dismissed" }) }) as InstallPromptEvent;
    rememberInstallPrompt(event);
    render(<PanelAplicativo />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Adicionar atalho/ })));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir a instalação");
    expect(screen.getByText(/Abra o menu do navegador/)).toBeInTheDocument();
  });
  it("records confirmed installations and lets the user reset the local record", () => {
    render(<PanelAplicativo />);
    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(screen.getByText(/A instalação foi confirmada ou informada/)).toBeInTheDocument();
    expect(localStorage.getItem("clouds:pwa-install-recorded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "informe que removeu" }));
    expect(localStorage.getItem("clouds:pwa-install-recorded")).toBeNull();
  });
  it("explains the iPhone share menu and optional web app setting", () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
    render(<PanelAplicativo />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar atalho/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Editar Ações");
    expect(screen.getByRole("dialog")).toHaveTextContent("Abrir como App Web");
  });
});
