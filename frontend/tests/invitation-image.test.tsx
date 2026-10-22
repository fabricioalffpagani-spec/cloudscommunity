// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET } from "../app/entrenoclouds/preview/route";
import sharp from "sharp";

vi.mock("../app/lib/invitation-preview", () => ({ getInvitationPreview: vi.fn(async () => ({ displayName: "Ana", username: "ana", avatarUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXsAAAAASUVORK5CYII=" })) }));

describe("invitation preview image", () => {
  it("renders a PNG using the sender's profile photo", async () => {
    const response = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234"));
    expect(response.headers.get("content-type")).toContain("image/png");
    const png = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
  it("includes the corner logo in previews shared from the arrow", async () => {
    const branded = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234"));
    const avatarOnly = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234&style=avatar"));
    const first = await sharp(Buffer.from(await branded.arrayBuffer())).ensureAlpha().raw().toBuffer();
    const second = await sharp(Buffer.from(await avatarOnly.arrayBuffer())).ensureAlpha().raw().toBuffer();
    expect(second.equals(first)).toBe(true);
    let logoPixels = 0;
    for (let y = 20; y < 88; y++) for (let x = 20; x < 100; x++) {
      const i = (y * 600 + x) * 4;
      if (second[i] !== 22 || second[i + 1] !== 5 || second[i + 2] !== 47) logoPixels++;
    }
    expect(logoPixels).toBeGreaterThan(0);
  });
});
