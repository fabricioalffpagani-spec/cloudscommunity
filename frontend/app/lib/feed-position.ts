"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

type FeedPositionOptions = {
  cloudIds: string[];
  feedRef: RefObject<HTMLDivElement | null>;
  initialCloudId?: string | null;
  scope?: string;
  order?: string;
  onActiveIndex?: (index: number) => void;
  navigationTargetRef?: RefObject<string | null>;
};

function pageTopInFeed(feed: HTMLElement, page: HTMLElement): number {
  return (
    feed.scrollTop +
    page.getBoundingClientRect().top -
    feed.getBoundingClientRect().top
  );
}

export function nearestCloudIndex(
  feed: HTMLElement,
  pages: HTMLElement[],
): number {
  const feedTop = feed.getBoundingClientRect().top;
  let best = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;
  pages.forEach((page, index) => {
    const distance = Math.abs(page.getBoundingClientRect().top - feedTop);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function replaceFeedPosition(
  cloudId: string,
  scope?: string,
  order?: string,
) {
  const url = new URL(window.location.href);
  if (
    url.searchParams.get("cloud") === cloudId &&
    (!scope || url.searchParams.get("scope") === scope) &&
    (!order || url.searchParams.get("order") === order)
  )
    return;
  url.searchParams.set("cloud", cloudId);
  if (scope) url.searchParams.set("scope", scope);
  if (order) url.searchParams.set("order", order);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function useFeedPosition({
  cloudIds,
  feedRef,
  initialCloudId,
  scope,
  order,
  onActiveIndex,
  navigationTargetRef,
}: FeedPositionOptions) {
  const initialId = useRef(initialCloudId);
  const restored = useRef(false);
  const lastActiveId = useRef<string | null>(null);
  const lastSignature = useRef("");
  const signature = cloudIds.join("\u0000");

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (
      !feed ||
      navigationTargetRef?.current ||
      !cloudIds.length ||
      (restored.current && lastSignature.current === signature)
    )
      return;
    const pages = Array.from(
      feed.querySelectorAll<HTMLElement>("[data-cloud-page]"),
    );
    if (pages.length !== cloudIds.length) return;
    const previousIndex = cloudIds.indexOf(lastActiveId.current ?? "");
    const index = restored.current
      ? previousIndex >= 0
        ? previousIndex
        : nearestCloudIndex(feed, pages)
      : Math.max(0, cloudIds.indexOf(initialId.current ?? ""));
    const previousBehavior = feed.style.scrollBehavior;
    feed.style.scrollBehavior = "auto";
    feed.scrollTop = pageTopInFeed(feed, pages[index]);
    feed.style.scrollBehavior = previousBehavior;
    restored.current = true;
    lastSignature.current = signature;
    lastActiveId.current = cloudIds[index];
    onActiveIndex?.(index);
    replaceFeedPosition(cloudIds[index], scope, order);
  }, [
    cloudIds,
    feedRef,
    navigationTargetRef,
    onActiveIndex,
    order,
    scope,
    signature,
  ]);

  const syncPosition = useCallback(() => {
    const feed = feedRef.current;
    if (!feed || !restored.current || navigationTargetRef?.current) return;
    const pages = Array.from(
      feed.querySelectorAll<HTMLElement>("[data-cloud-page]"),
    );
    if (!pages.length) return;
    const index = nearestCloudIndex(feed, pages);
    const id = cloudIds[index];
    if (!id || id === lastActiveId.current) return;
    lastActiveId.current = id;
    onActiveIndex?.(index);
    replaceFeedPosition(id, scope, order);
  }, [cloudIds, feedRef, navigationTargetRef, onActiveIndex, order, scope]);

  return syncPosition;
}
