import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoogleAuthButton } from "../app/components/GoogleAuthButton";

describe("Google authentication UI", () => {
  it("preserves the visitor return context in the Google login URL", () => {
    render(<GoogleAuthButton returnTo="/cloud/cloud-1?join=1" />);
    const link = screen.getByRole("link", { name: "Continuar com Google" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("returnTo=%2Fcloud%2Fcloud-1%3Fjoin%3D1"),
    );
  });

  it("uses the explicit account-linking intent from settings", () => {
    render(<GoogleAuthButton returnTo="/settings" intent="link" />);
    const link = screen.getByRole("link", { name: "Vincular conta Google" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("intent=link"),
    );
  });
});
