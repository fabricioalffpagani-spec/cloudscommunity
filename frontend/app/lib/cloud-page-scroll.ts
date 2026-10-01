/** Move at most one Cloud for each wheel burst or touch gesture. */
export function installCloudPageScroll(feed: HTMLElement) {
  let selectedIndex = -1;
  let wheelTimer: number | undefined;
  let touchStartY: number | null = null;
  const pages = () => Array.from(feed.querySelectorAll<HTMLElement>("[data-cloud-page]"));
  const topOf = (page: HTMLElement) => page.getBoundingClientRect().top - feed.getBoundingClientRect().top + feed.scrollTop;
  const nearestIndex = (all: HTMLElement[]) => all.reduce((best, page, index) =>
    best < 0 || Math.abs(topOf(page) - feed.scrollTop) < Math.abs(topOf(all[best]) - feed.scrollTop) ? index : best, -1);
  const move = (direction: number) => {
    const all = pages();
    if (!all.length) return;
    const current = selectedIndex < 0 ? nearestIndex(all) : selectedIndex;
    selectedIndex = Math.max(0, Math.min(current + direction, all.length - 1));
    feed.scrollTo({ top: topOf(all[selectedIndex]), behavior: "smooth" });
  };
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || Math.abs(event.deltaY) < 4) return;
    event.preventDefault();
    if (wheelTimer === undefined) move(Math.sign(event.deltaY));
    else window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheelTimer = undefined; }, 650);
  };
  const onTouchStart = (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const endY = event.changedTouches[0]?.clientY;
    if (touchStartY !== null && endY !== undefined && Math.abs(endY - touchStartY) > 35) {
      move(touchStartY > endY ? 1 : -1);
    }
    touchStartY = null;
  };
  feed.addEventListener("wheel", onWheel, { passive: false });
  feed.addEventListener("touchstart", onTouchStart, { passive: true });
  feed.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    if (wheelTimer !== undefined) window.clearTimeout(wheelTimer);
    feed.removeEventListener("wheel", onWheel);
    feed.removeEventListener("touchstart", onTouchStart);
    feed.removeEventListener("touchend", onTouchEnd);
  };
}
