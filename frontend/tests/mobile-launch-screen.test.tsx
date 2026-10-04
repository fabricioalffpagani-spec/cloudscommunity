import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileLaunchScreen } from "../app/components/MobileLaunchScreen";

describe("PWA launch screen", () => {
  it("shows the existing Clouds Community wordmark under the logo on mobile", () => {
    render(<MobileLaunchScreen />);
    const screenElement = screen.getByLabelText("Abrindo Clouds Community");
    expect(screenElement).toHaveClass("flex", "md:hidden");
    expect(screenElement.querySelector("img")).toBeInTheDocument();
    expect(screenElement).toHaveTextContent("Clouds");
    expect(screenElement).toHaveTextContent("Community");
  });
});
