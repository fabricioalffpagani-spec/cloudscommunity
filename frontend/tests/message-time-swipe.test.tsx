import { describe, expect, it } from "vitest";
import { getRevealedMessageTimeSide, isMessageReplySwipe, nextRevealedMessageTimeSide } from "../app/lib/message-time-swipe";

describe("message timestamp swipe", () => {
  it("reveals all own-message timestamps when the conversation is swiped left", () => {
    expect(getRevealedMessageTimeSide(-36)).toBe("right");
  });

  it("reveals all received-message timestamps when the conversation is swiped right", () => {
    expect(getRevealedMessageTimeSide(36)).toBe("left");
  });

  it("ignores short horizontal movements", () => {
    expect(getRevealedMessageTimeSide(-35)).toBeNull();
    expect(getRevealedMessageTimeSide(35)).toBeNull();
  });

  it("keeps timestamps visible until an opposite conversation swipe", () => {
    const ownMessages = nextRevealedMessageTimeSide(null, "right");
    expect(ownMessages).toBe("right");
    expect(nextRevealedMessageTimeSide(ownMessages, "right")).toBe("right");
    expect(nextRevealedMessageTimeSide(ownMessages, "left")).toBeNull();
  });

  it("recognizes a horizontal message drag as a reply gesture", () => {
    expect(isMessageReplySwipe(44, 0)).toBe(true);
    expect(isMessageReplySwipe(-44, 48)).toBe(true);
  });

  it("does not reply while the person scrolls or makes a short drag", () => {
    expect(isMessageReplySwipe(43, 0)).toBe(false);
    expect(isMessageReplySwipe(44, 49)).toBe(false);
  });
});
