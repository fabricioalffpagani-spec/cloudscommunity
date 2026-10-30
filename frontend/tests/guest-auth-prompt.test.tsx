import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuestCloudSignupModal } from "../app/components/GuestCloudSignupModal";
import { MessagesNavLink } from "../app/components/MessagesNavLink";

vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ user: null, status: "anonymous" }),
}));

describe("visitor authentication prompts", () => {
  it("preserves the current Cloud in login and signup links", () => {
    render(<GuestCloudSignupModal returnTo="/cloud/cloud-1?message=message-2" onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fcloud%2Fcloud-1%3Fmessage%3Dmessage-2",
    );
    expect(screen.getByRole("link", { name: "Criar minha conta" })).toHaveAttribute(
      "href",
      "/signup?from=interaction&returnTo=%2Fcloud%2Fcloud-1%3Fmessage%3Dmessage-2",
    );
  });

  it("does not request private conversations and sends Messages to login", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MessagesNavLink />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fmessages",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
