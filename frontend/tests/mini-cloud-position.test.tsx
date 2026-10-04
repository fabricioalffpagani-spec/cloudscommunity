import { describe, expect, it } from "vitest";
import { clampMiniCloudPosition } from "../app/lib/mini-cloud-position";

describe("Mini Cloud drag boundaries", () => {
  it("keeps the dock on screen on mobile and after orientation changes", () => {
    expect(clampMiniCloudPosition(-900, -900, 280, 268, 390, 844)).toEqual({
      x: -102,
      y: -568,
    });
    expect(clampMiniCloudPosition(900, 900, 280, 268, 390, 844)).toEqual({
      x: 8,
      y: 8,
    });
    expect(clampMiniCloudPosition(-102, -568, 280, 268, 844, 390)).toEqual({
      x: -102,
      y: -114,
    });
  });
});
