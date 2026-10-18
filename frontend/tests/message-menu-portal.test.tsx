import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageMenuPortal } from "../app/components/MessageMenuPortal";

describe("message menu portal", () => {
  it("renders above clipped message containers in document.body", () => {
    const anchor = document.createElement("div");
    anchor.getBoundingClientRect = () => ({
      x: 100,
      y: 80,
      left: 100,
      right: 100,
      top: 80,
      bottom: 80,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    });
    const menuRef = createRef<HTMLDivElement>();
    const anchorRef = { current: anchor };
    const { unmount } = render(
      <MessageMenuPortal anchorRef={anchorRef} menuRef={menuRef}>
        <button type="button">Fixar mensagem</button>
      </MessageMenuPortal>,
    );

    const portal = screen
      .getByText("Fixar mensagem")
      .closest("[data-message-menu-portal]");
    expect(portal?.parentElement).toBe(document.body);
    expect(portal).toHaveClass("z-[9999]");
    expect(menuRef.current).toBe(portal);
    unmount();
  });
});
