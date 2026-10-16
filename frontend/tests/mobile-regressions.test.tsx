import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagesNavLink } from "../app/components/MessagesNavLink";
import { MobileAppNav, useMobileFeedTabSwipe } from "../app/components/MobileAppChrome";
import { PwaInstallPrompt } from "../app/components/PwaInstallPrompt";
import { installComposerPanLock } from "../app/lib/composer-pan-lock";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn(), prefetch: vi.fn() }));
const originalUserAgent = window.navigator.userAgent;
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, prefetch: navigation.prefetch }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ status: "authenticated", user: { id: "u", username: "tester", createdAt: "2026-10-14T00:00:00.000Z" } }),
  SessionUserAvatar: () => null,
}));

function SwipeProbe() {
  return <div data-testid="swipe" {...useMobileFeedTabSwipe()} />;
}

afterEach(() => {
  navigation.pathname = "/";
  navigation.push.mockClear();
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: originalUserAgent });
  if (originalLocalStorageDescriptor) Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  else delete (window as { localStorage?: Storage }).localStorage;
  vi.useRealTimers();
});

describe("mobile regressions", () => {
  it("blocks dragging the composer while preserving picker scrolling", () => {
    const footer = document.createElement("div");
    const input = document.createElement("textarea");
    const picker = document.createElement("div");
    picker.dataset.emojiPicker = "true";
    footer.append(input, picker);
    const cleanup = installComposerPanLock(footer);

    const composerDrag = new Event("touchmove", { bubbles: true, cancelable: true });
    input.dispatchEvent(composerDrag);
    expect(composerDrag.defaultPrevented).toBe(true);

    const pickerScroll = new Event("touchmove", { bubbles: true, cancelable: true });
    picker.dispatchEvent(pickerScroll);
    expect(pickerScroll.defaultPrevented).toBe(false);

    cleanup();
    const afterUnmount = new Event("touchmove", { bubbles: true, cancelable: true });
    input.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("shows unread conversations on the mobile Messages icon", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conversations: [{ id: "a", unreadCount: 2 }] }) }));
    render(<MobileAppNav force />);
    expect(await screen.findByRole("link", { name: /Messages, 1 contato/ })).toHaveTextContent("1");
  });

  it("refreshes the Messages badge when a message arrives", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ conversations: [] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ conversations: [{ id: "a", unreadCount: 1 }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MessagesNavLink />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event("direct-message-received")));
    expect(await screen.findByRole("link", { name: /1 contato/ })).toBeVisible();
  });

  it("shows the install reminder on desktop six minutes after registration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T00:06:00.000Z"));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    render(<PwaInstallPrompt />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Adicione um atalho para o Clouds na tela inicial para economizar tempo!");
  });

  it("does not remind an iPhone user again after they confirm adding the shortcut", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T00:06:00.000Z"));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const stored = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
    });
    Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
    const first = render(<PwaInstallPrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar atalho" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Adicione o Clouds à Tela de Início");
    fireEvent.click(screen.getByRole("button", { name: "Já adicionei o atalho" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    first.unmount();
    render(<PwaInstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("swipes left from Talk to Read and then Meet", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const { getByTestId, rerender } = render(<SwipeProbe />);
    const swipe = getByTestId("swipe");
    fireEvent.touchStart(swipe, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(swipe, { changedTouches: [{ clientX: 80, clientY: 104 }] });
    expect(navigation.push).toHaveBeenCalledWith("/read");
    navigation.pathname = "/read";
    rerender(<SwipeProbe />);
    // The navigation lock expires after its transition.
    act(() => vi.advanceTimersByTime(400));
    fireEvent.touchStart(swipe, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(swipe, { changedTouches: [{ clientX: 80, clientY: 104 }] });
    expect(navigation.push).toHaveBeenCalledWith("/meet");
  });

});
