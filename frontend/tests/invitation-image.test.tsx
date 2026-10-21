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
  it("removes only the corner logo from the avatar-only preview", async () => {
    const branded = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234"));
    const avatarOnly = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234&style=avatar"));
    const first = await sharp(Buffer.from(await branded.arrayBuffer())).ensureAlpha().raw().toBuffer();
    const second = await sharp(Buffer.from(await avatarOnly.arrayBuffer())).ensureAlpha().raw().toBuffer();
    let cornerChanges = 0;
    let otherChanges = 0;
    for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) {
      const i = (y * 600 + x) * 4;
      if (first[i] !== second[i] || first[i + 1] !== second[i + 1] || first[i + 2] !== second[i + 2] || first[i + 3] !== second[i + 3]) {
        if (x >= 20 && x < 100 && y >= 20 && y < 88) cornerChanges++;
        else otherChanges++;
      }
    }
    expect(cornerChanges).toBeGreaterThan(0);
    expect(otherChanges).toBe(0);
  });
});
