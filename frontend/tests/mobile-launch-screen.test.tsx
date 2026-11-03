import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileLaunchScreen } from "../app/components/MobileLaunchScreen";

describe("PWA launch screen", () => {
  beforeEach(() => window.sessionStorage.clear());

  function mockDisplayMode({ standalone, mobile }: { standalone: boolean; mobile: boolean }) {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query.includes("display-mode") ? standalone : mobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  }

  it("does not render during normal desktop or site navigation", () => {
    mockDisplayMode({ standalone: false, mobile: false });
    render(<MobileLaunchScreen />);
    expect(screen.queryByLabelText("Abrindo Clouds Community")).not.toBeInTheDocument();
  });

  it("shows the wordmark only on the first mobile PWA launch in the session", async () => {
    mockDisplayMode({ standalone: true, mobile: true });
    render(<MobileLaunchScreen />);
    const screenElement = await screen.findByLabelText("Abrindo Clouds Community");
    expect(screenElement).toHaveClass("flex", "md:hidden");
    expect(screenElement.querySelector("img")).toBeInTheDocument();
    expect(screenElement).toHaveTextContent("Clouds");
    expect(screenElement).toHaveTextContent("Community");

    render(<MobileLaunchScreen />);
    await waitFor(() => {
      expect(screen.getAllByLabelText("Abrindo Clouds Community")).toHaveLength(1);
    });
  });
});
