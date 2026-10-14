import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadWelcomeHint } from "../app/components/ReadWelcomeHint";

function whiteTextContrastOn(
  backdrop: readonly [number, number, number],
  background: string,
) {
  const values = background.match(
    /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
  );
  if (!values) throw new Error(`Invalid hint background: ${background}`);
  const opacity = Number(values[4]);
  const channels = [1, 2, 3].map(
    (index) =>
      Number(values[index]) * opacity + backdrop[index - 1] * (1 - opacity),
  );
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return 1.05 / (luminance + 0.05);
}

describe("Read first-visit hint", () => {
  it.each([
    ["light", [255, 255, 255]],
    ["dark", [3, 2, 8]],
  ] as const)(
    "keeps white text readable over %s Cloud content",
    (_, backdrop) => {
      render(<ReadWelcomeHint fading={false} />);
      const overlay = screen.getByRole("status");
      const card = screen.getByText("Leia conversas que já aconteceram...");
      expect(overlay).toHaveClass(
        "fixed",
        "z-[80]",
        "items-center",
        "justify-center",
        "md:hidden",
      );
      expect(card).toHaveClass(
        "text-white",
        "rounded-2xl",
        "px-6",
        "py-5",
        "max-w-[22rem]",
        "[overflow-wrap:anywhere]",
      );
      expect(
        whiteTextContrastOn(backdrop, card.style.backgroundColor),
      ).toBeGreaterThanOrEqual(7);
    },
  );

  it("keeps the existing fade-out behavior", () => {
    const { rerender } = render(<ReadWelcomeHint fading={false} />);
    expect(screen.getByRole("status")).toHaveClass("opacity-100");
    rerender(<ReadWelcomeHint fading />);
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
  });
});
