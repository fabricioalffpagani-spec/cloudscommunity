const MINIMUM_SWIPE_DISTANCE = 36;
const MINIMUM_REPLY_SWIPE_DISTANCE = 44;
const MAXIMUM_REPLY_SWIPE_VERTICAL_DISTANCE = 48;

/** A conversation swipe reveals all sent or all received message timestamps. */
export function getRevealedMessageTimeSide(deltaX: number): "left" | "right" | null {
  if (deltaX <= -MINIMUM_SWIPE_DISTANCE) return "right";
  if (deltaX >= MINIMUM_SWIPE_DISTANCE) return "left";
  return null;
}

/** Keeps timestamps visible until the conversation is swiped in the opposite direction. */
export function nextRevealedMessageTimeSide(
  currentSide: "left" | "right" | null,
  swipeSide: "left" | "right" | null,
): "left" | "right" | null {
  if (!swipeSide) return currentSide;
  return currentSide && currentSide !== swipeSide ? null : swipeSide;
}

/** A horizontal drag on an individual message starts a reply without mistaking vertical scrolling for a swipe. */
export function isMessageReplySwipe(deltaX: number, deltaY: number): boolean {
  return (
    Math.abs(deltaX) >= MINIMUM_REPLY_SWIPE_DISTANCE &&
    Math.abs(deltaY) <= MAXIMUM_REPLY_SWIPE_VERTICAL_DISTANCE
  );
}
