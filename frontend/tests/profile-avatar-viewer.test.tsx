import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAvatarViewer } from "../app/components/ProfileAvatarViewer";

describe("profile avatar viewer", () => {
  it("opens a real photo and closes with Escape, close button, or backdrop", () => {
    render(
      <ProfileAvatarViewer avatarUrl="/photo.png" name="Ana">
        <span>A</span>
      </ProfileAvatarViewer>,
    );
    const trigger = screen.getByRole("button", {
      name: "Ampliar foto de perfil de Ana",
    });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Foto de perfil de Ana" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Foto de perfil de Ana" }),
    ).toHaveClass("object-contain");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fechar foto" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a short toast for an initial without opening a dialog", () => {
    render(
      <ProfileAvatarViewer avatarUrl={null} name="Ana">
        <span>A</span>
      </ProfileAvatarViewer>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ampliar foto de perfil de Ana" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sem foto de perfil");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("treats a failed image as an avatar fallback", () => {
    render(
      <ProfileAvatarViewer avatarUrl="/missing.png" name="Ana">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/missing.png" alt="" />
      </ProfileAvatarViewer>,
    );
    fireEvent.error(
      screen
        .getByRole("button", { name: "Ampliar foto de perfil de Ana" })
        .querySelector("img")!,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ampliar foto de perfil de Ana" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sem foto de perfil");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
