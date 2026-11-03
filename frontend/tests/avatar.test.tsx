import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "../app/components/session-user";

const photographedUser = {
  id: "user-1",
  username: "vicente",
  displayName: "Vicente",
  avatarUrl: "/avatar.jpg",
};

describe("shared avatar", () => {
  it("uses the standard user icon for a visitor instead of V", () => {
    render(<UserAvatar user={null} />);
    expect(screen.getByTestId("default-avatar-icon")).toBeVisible();
    expect(screen.queryByText("V")).not.toBeInTheDocument();
  });

  it("keeps the standard icon while a photo loads and reveals only a successful image", () => {
    render(<UserAvatar user={photographedUser} />);
    const image = screen.getByRole("img", { name: "Vicente" });
    expect(screen.getByTestId("default-avatar-icon")).toBeVisible();
    expect(image).toHaveClass("opacity-0");
    expect(screen.queryByText("V")).not.toBeInTheDocument();
    fireEvent.load(image);
    expect(image).toHaveClass("opacity-100");
  });

  it("returns to the standard icon when the photo fails", () => {
    render(<UserAvatar user={photographedUser} />);
    fireEvent.error(screen.getByRole("img", { name: "Vicente" }));
    expect(screen.getByTestId("default-avatar-icon")).toBeVisible();
    expect(screen.queryByRole("img", { name: "Vicente" })).not.toBeInTheDocument();
    expect(screen.queryByText("V")).not.toBeInTheDocument();
  });

  it("preserves initials for an authenticated user who definitively has no photo", () => {
    render(<UserAvatar user={{ ...photographedUser, displayName: "Maria", avatarUrl: null }} />);
    expect(screen.getByText("M")).toBeVisible();
    expect(screen.queryByTestId("default-avatar-icon")).not.toBeInTheDocument();
  });
});
