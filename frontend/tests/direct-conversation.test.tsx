import { describe, expect, it } from "vitest";
import { isConversationForViewer } from "../app/lib/direct-conversation";

const sentEvent = {
  participantOneId: "vicente",
  participantTwoId: "fabricio",
  participant: { id: "fabricio" },
};
const receivedEvent = {
  participantOneId: "vicente",
  participantTwoId: "fabricio",
  participant: { id: "vicente" },
};

describe("DM conversation participant", () => {
  it("keeps the other user for sent and received message events", () => {
    expect(isConversationForViewer(sentEvent, "vicente")).toBe(true);
    expect(isConversationForViewer(receivedEvent, "fabricio")).toBe(true);
  });

  it("rejects an event that would insert the current user as their own contact", () => {
    expect(isConversationForViewer(receivedEvent, "vicente")).toBe(false);
    expect(isConversationForViewer(sentEvent, "fabricio")).toBe(false);
  });

  it("rejects self-DMs and unrelated conversations", () => {
    expect(
      isConversationForViewer(
        {
          ...sentEvent,
          participantTwoId: "vicente",
          participant: { id: "vicente" },
        },
        "vicente",
      ),
    ).toBe(false);
    expect(isConversationForViewer(sentEvent, "another-user")).toBe(false);
  });
});
