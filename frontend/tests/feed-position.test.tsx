import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef, type RefObject } from "react";
import { useFeedPosition } from "../app/lib/feed-position";

const ids = Array.from({ length: 15 }, (_, index) => `cloud-${index + 1}`);

function Feed({
  initialCloudId,
  scope,
  order,
  cloudIds = ids,
  navigationTargetRef,
}: {
  initialCloudId?: string | null;
  scope?: string;
  order?: string;
  cloudIds?: string[];
  navigationTargetRef?: RefObject<string | null>;
}) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const syncPosition = useFeedPosition({
    cloudIds,
    feedRef,
    initialCloudId,
    scope,
    order,
    navigationTargetRef,
  });
  return (
    <div data-testid="feed" ref={feedRef} onScroll={syncPosition}>
      {cloudIds.map((id) => (
        <article key={id} data-cloud-page>
          {id}
        </article>
      ))}
    </div>
  );
}

describe("feed position", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/read");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const index = Array.from(this.parentElement?.children ?? []).indexOf(
          this,
        );
        const top = this.hasAttribute("data-cloud-page")
          ? 100 + index * 500 - (this.parentElement?.scrollTop ?? 0)
          : 100;
        return { top } as DOMRect;
      },
    );
  });

  it("restores the eleventh Cloud directly by stable ID and updates the same history entry", () => {
    window.history.replaceState(
      { preserved: true },
      "",
      "/read?cloud=cloud-11",
    );
    const replace = vi.spyOn(window.history, "replaceState");
    const { getByTestId } = render(
      <Feed initialCloudId="cloud-11" scope="for-you" />,
    );
    const feed = getByTestId("feed");
    expect(feed.scrollTop).toBe(5000);
    expect(window.location.search).toContain("cloud=cloud-11");
    expect(window.history.state).toEqual({ preserved: true });
    feed.scrollTop = 5500;
    fireEvent.scroll(feed);
    expect(window.location.search).toContain("cloud=cloud-12");
    expect(replace).toHaveBeenCalled();
    replace.mockRestore();
  });

  it("restores Talk with its filter and order after browser back", () => {
    window.history.replaceState(
      null,
      "",
      "/?cloud=cloud-14&scope=following&order=recent",
    );
    const { getByTestId } = render(
      <Feed initialCloudId="cloud-14" scope="following" order="recent" />,
    );
    expect(getByTestId("feed").scrollTop).toBe(6500);
    expect(window.location.search).toContain("scope=following");
    expect(window.location.search).toContain("order=recent");
  });

  it("uses the feed viewport when offsetTop has a different origin", () => {
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(0);
    const { getByTestId } = render(
      <Feed initialCloudId="cloud-11" scope="for-you" />,
    );
    const feed = getByTestId("feed");
    expect(feed.scrollTop).toBe(5000);
    feed.scrollTop = 6000;
    fireEvent.scroll(feed);
    expect(window.location.search).toContain("cloud=cloud-13");
  });

  it("does not let a late scroll event replace the Cloud selected for navigation", () => {
    const navigationTargetRef = { current: null as string | null };
    const { getByTestId, rerender, unmount } = render(
      <Feed
        initialCloudId="cloud-11"
        navigationTargetRef={navigationTargetRef}
      />,
    );
    const feed = getByTestId("feed");
    navigationTargetRef.current = "cloud-11";
    feed.scrollTop = 4500;
    fireEvent.scroll(feed);
    expect(window.location.search).toContain("cloud=cloud-11");
    rerender(
      <Feed
        initialCloudId="cloud-11"
        cloudIds={[ids[9], ...ids.filter((id) => id !== "cloud-10")]}
        navigationTargetRef={navigationTargetRef}
      />,
    );
    expect(window.location.search).toContain("cloud=cloud-11");
    unmount();
    const returning = render(
      <Feed
        initialCloudId={new URLSearchParams(window.location.search).get(
          "cloud",
        )}
      />,
    );
    expect(returning.getByTestId("feed").scrollTop).toBe(5000);
  });

  it("falls back to the first Cloud when the requested Cloud is gone", () => {
    window.history.replaceState(null, "", "/read?cloud=deleted");
    const { getByTestId } = render(<Feed initialCloudId="deleted" />);
    expect(getByTestId("feed").scrollTop).toBe(0);
    expect(window.location.search).toContain("cloud=cloud-1");
  });

  it("keeps the same Cloud after a feed reorder and falls back nearby if it disappears", () => {
    const { getByTestId, rerender } = render(
      <Feed initialCloudId="cloud-11" />,
    );
    const feed = getByTestId("feed");
    expect(feed.scrollTop).toBe(5000);
    rerender(
      <Feed
        initialCloudId="cloud-11"
        cloudIds={[ids[10], ...ids.filter((id) => id !== "cloud-11")]}
      />,
    );
    expect(feed.scrollTop).toBe(0);
    rerender(
      <Feed
        initialCloudId="cloud-11"
        cloudIds={ids.filter((id) => id !== "cloud-11")}
      />,
    );
    expect(window.location.search).not.toContain("cloud=cloud-11");
  });
});
