import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileFeedHeader } from "../app/components/MobileAppChrome";
import { messagesConversationHref, requestedConversationId } from "../app/lib/navigation-memory";
import { buildMessageContactList } from "../app/lib/message-contacts";
import { CloudScopeTabs } from "../app/components/CloudScopeTabs";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/read" }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: null }), SessionUserAvatar: () => null }));

describe("Mobile feed navigation", () => {
  it("replaces the old tabs with Talk, Read and Meet in that order", () => {
    render(<MobileFeedHeader active="following" />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Talk", "Read", "Meet"]);
    expect(screen.getByRole("link", { name: "Talk" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute("href", "/read");
    expect(screen.getByRole("link", { name: "Meet" })).toHaveAttribute("href", "/meet");
  });
});

describe("Cloud feed filters", () => {
  it("switches between recommended clouds and clouds from followed people", () => {
    const onChange = vi.fn();
    render(<CloudScopeTabs value="for-you" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "For You" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Seguindo" }));
    expect(onChange).toHaveBeenCalledWith("following");
  });
});

describe("Navigation memory", () => {
  it("stores a selected direct conversation in the URL and restores it on return", () => {
    const href = messagesConversationHref("conversation 1");
    expect(href).toBe("/messages?conversation=conversation%201");
    expect(requestedConversationId(new URLSearchParams(href.split("?")[1]))).toBe("conversation 1");
  });

  it("keeps the base Messages route without an open conversation", () => {
    expect(requestedConversationId(new URLSearchParams())).toBeNull();
  });
});

describe("Messages contact list", () => {
  it("keeps conversations received from people the user does not follow", () => {
    const incomingConversation = { peerId: "follower", peerUsername: "seguidor", name: "Pessoa que me segue", lastMessageAt: "2026-09-21" };
    const followedContact = { id: "followed", username: "seguido", displayName: "Pessoa seguida" };

    expect(buildMessageContactList([incomingConversation], [followedContact], ""))
      .toEqual([incomingConversation, followedContact]);
  });

  it("does not duplicate followed contacts that already have a conversation", () => {
    const conversation = { peerId: "same", peerUsername: "pessoa", name: "Pessoa", lastMessageAt: "2026-09-21" };
    const followedContact = { id: "same", username: "pessoa", displayName: "Pessoa" };

    expect(buildMessageContactList([conversation], [followedContact], "")).toEqual([conversation]);
  });
});
