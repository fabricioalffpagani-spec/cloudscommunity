import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheFeed, getCachedFeed } from "../app/lib/feed-cache";

afterEach(() => vi.useRealTimers());

describe("feed cache", () => {
  it("reuses the loaded feed for the same user and filter, then expires it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const clouds = [{ id: "cloud-11" }];
    cacheFeed("talk:user-a:following", clouds);
    expect(getCachedFeed("talk:user-a:following")).toBe(clouds);
    expect(getCachedFeed("talk:user-b:following")).toBeNull();
    expect(getCachedFeed("talk:user-a:for-you")).toBeNull();
    vi.advanceTimersByTime(30_001);
    expect(getCachedFeed("talk:user-a:following")).toBeNull();
  });

  it("does not cache an unverified user feed", () => {
    cacheFeed("", [{ id: "private-cloud" }]);
    expect(getCachedFeed("")).toBeNull();
  });
});
