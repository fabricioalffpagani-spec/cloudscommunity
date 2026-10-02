import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installCloudPageScroll } from "../app/lib/cloud-page-scroll";
import { MessagesNavLink } from "../app/components/MessagesNavLink";
import { MobileAppNav, useMobileFeedTabSwipe } from "../app/components/MobileAppChrome";
import { PwaInstallPrompt } from "../app/components/PwaInstallPrompt";
import { installComposerPanLock } from "../app/lib/composer-pan-lock";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, prefetch: navigation.prefetch }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ status: "authenticated", user: { id: "u", username: "tester" } }),
  SessionUserAvatar: () => null,
}));

function SwipeProbe() {
  return <div data-testid="swipe" {...useMobileFeedTabSwipe()} />;
}

afterEach(() => {
  navigation.pathname = "/";
  navigation.push.mockClear();
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

  it("keeps the install dialog off desktop", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    render(<PwaInstallPrompt />);
    act(() => window.dispatchEvent(new Event("beforeinstallprompt")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("moves exactly one Cloud per wheel burst and per touch gesture", () => {
    vi.useFakeTimers();
    const feed = document.createElement("div");
    Object.defineProperty(feed, "scrollTop", { value: 0, writable: true });
    feed.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    const scrollTo = vi.fn(({ top }: { top: number }) => { feed.scrollTop = top; });
    feed.scrollTo = scrollTo as unknown as typeof feed.scrollTo;
    for (let i = 0; i < 4; i += 1) {
      const page = document.createElement("article");
      page.dataset.cloudPage = "";
      page.getBoundingClientRect = () => ({ top: i * 500 - feed.scrollTop } as DOMRect);
      feed.appendChild(page);
    }
    const cleanup = installCloudPageScroll(feed);
    for (let i = 0; i < 5; i += 1) feed.dispatchEvent(new WheelEvent("wheel", { deltaY: 700, cancelable: true }));
    expect(feed.scrollTop).toBe(500);
    vi.advanceTimersByTime(700);
    feed.dispatchEvent(new WheelEvent("wheel", { deltaY: 700, cancelable: true }));
    expect(feed.scrollTop).toBe(1000);
    fireEvent.touchStart(feed, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(feed, { changedTouches: [{ clientY: 100 }] });
    expect(feed.scrollTop).toBe(1500);
    expect(scrollTo).toHaveBeenCalledTimes(3);
    cleanup();
  });
});
